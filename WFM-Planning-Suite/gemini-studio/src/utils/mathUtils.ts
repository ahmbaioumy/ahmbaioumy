import { SizingModel, ChannelParams } from '../types';

/**
 * Numerically stable Erlang C calculation to avoid factorial or power overflow.
 * Returns probability of delay (Pc).
 */
export function calculateErlangC(N: number, A: number): number {
  if (N <= A) return 1.0; // Queue will grow to infinity

  let sum = 1.0;
  let term = 1.0;

  for (let k = 1; k < N; k++) {
    term = term * (A / k);
    sum += term;
  }

  const termN = term * (A / N);
  const factor = N / (N - A);
  const denominator = sum + termN * factor;

  if (denominator === 0) return 0;
  return (termN * factor) / denominator;
}

/**
 * Numerically stable Erlang B calculation (recursive).
 * Returns blocking probability.
 */
export function calculateErlangB(N: number, A: number): number {
  let p = 1.0; // Erlang B for N=0
  for (let i = 1; i <= N; i++) {
    p = (A * p) / (i + A * p);
  }
  return p;
}

/**
 * Erlang A approximation incorporating agent patience (abandonment).
 * Tp is the average patience (Time to Abandon, e.g., 180 seconds).
 * Returns { abandonmentRate: number, slaPercent: number, asaSeconds: number }
 */
export function calculateErlangA(
  N: number,
  A: number,
  aht: number,
  targetSlaSec: number,
  averagePatienceSec: number = 180
): {
  abandonRate: number;
  slaPercent: number;
  asaSeconds: number;
} {
  if (N <= 0) return { abandonRate: 100, slaPercent: 0, asaSeconds: 999 };

  // Calculate Erlang C delay probability as a baseline
  const pc = calculateErlangC(N, A);

  if (N <= A) {
    // Under-staffed. Abandonment limits the queue growth.
    // In Erlang A, under-staffed situations settle because customers hang up.
    const excess = A - N;
    const patienceRatio = averagePatienceSec / (aht || 1);
    const abandonRate = Math.min(95, (excess / (A || 1)) * 100);
    const asaSeconds = Math.max(10, averagePatienceSec * (abandonRate / 100));
    
    // SLA estimation
    const slaPercent = Math.max(5, 100 * Math.exp(-targetSlaSec / (asaSeconds || 1)));
    return { abandonRate, slaPercent, asaSeconds };
  }

  // Over-staffed or balanced
  // Effective waiting time / abandonment approximation
  const theta = 1 / averagePatienceSec;
  const mu = 1 / aht;
  const divisor = (N * mu - A * mu + theta);
  
  const asaSeconds = pc / (divisor || 1);
  const abandonRate = Math.min(100, pc * theta / (divisor || 1) * 100);

  // SLA calculation
  const slaPercent = Math.min(100, Math.max(0, (1 - pc * Math.exp(-divisor * targetSlaSec)) * 100));

  return {
    abandonRate,
    slaPercent,
    asaSeconds: Math.max(1, asaSeconds)
  };
}

/**
 * Solves the required staffing count for a specific interval using the chosen Erlang/Workload model.
 */
export function calculateStaffingNeeded(
  model: SizingModel,
  volume: number, // calls per 30-min interval
  aht: number,    // in seconds
  params: ChannelParams,
  intervalDurationMin: number = 30
): {
  rawRequired: number;
  occupancyAdjusted: number;
  shrinkageAdjusted: number;
  finalRequired: number;
  slaPercent: number;
  asaSeconds: number;
  abandonRate: number;
} {
  if (volume <= 0 || aht <= 0) {
    return {
      rawRequired: 0,
      occupancyAdjusted: 0,
      shrinkageAdjusted: 0,
      finalRequired: 0,
      slaPercent: 100,
      asaSeconds: 0,
      abandonRate: 0
    };
  }

  // Calculate Traffic Intensity (A)
  // Volume * AHT / (Interval Duration in seconds)
  const intervalSeconds = intervalDurationMin * 60;
  const A = (volume * aht) / intervalSeconds;

  let rawRequired = 1;
  let slaPercent = 100;
  let asaSeconds = 0;
  let abandonRate = 0;

  if (model === 'workload') {
    // Pure processing workload FTE calculation (no queuing math, e.g. email or backoffice complaints)
    rawRequired = Math.ceil(A);
    slaPercent = 100;
    asaSeconds = 0;
    abandonRate = 0;
  } 
  else if (model === 'erlang_b') {
    // Trunk Sizing / Blocking model
    // Find N such that Blocking Probability <= target (represented as 100 - targetAnswerPercent)
    const targetBlock = (100 - params.targetAnswerPercent) / 100;
    rawRequired = Math.ceil(A) || 1;
    let currentBlock = 1.0;

    for (let N = rawRequired; N < 1000; N++) {
      currentBlock = calculateErlangB(N, A);
      if (currentBlock <= targetBlock) {
        rawRequired = N;
        break;
      }
    }
    abandonRate = currentBlock * 100;
    slaPercent = (1 - currentBlock) * 100;
    asaSeconds = currentBlock * 10; // estimation
  } 
  else if (model === 'erlang_a') {
    // Abandonment queue
    rawRequired = Math.ceil(A) || 1;
    for (let N = rawRequired; N < 1000; N++) {
      const res = calculateErlangA(N, A, aht, params.targetSlaSeconds, 180);
      if (res.slaPercent >= params.targetSlaPercent && res.abandonRate <= (100 - params.targetAnswerPercent)) {
        rawRequired = N;
        slaPercent = res.slaPercent;
        asaSeconds = res.asaSeconds;
        abandonRate = res.abandonRate;
        break;
      }
    }
  } 
  else if (model === 'blended') {
    // Blended Digital Concurrency limit (e.g. Chat agent can handle 2.5 parallel tasks)
    const concurrency = 2.0; // default multi-task threshold
    const blendedA = A / concurrency;
    rawRequired = Math.ceil(blendedA) || 1;

    for (let N = rawRequired; N < 1000; N++) {
      const pc = calculateErlangC(N, blendedA);
      const asa = pc * (aht / concurrency) / (N - blendedA || 1);
      const sla = (1 - pc * Math.exp(-(N - blendedA) * params.targetSlaSeconds / (aht / concurrency))) * 100;
      
      if (sla >= params.targetSlaPercent && (blendedA / N * 100) <= params.occupancyTarget) {
        rawRequired = N;
        slaPercent = Math.min(100, Math.max(0, sla));
        asaSeconds = Math.max(1, asa);
        break;
      }
    }
  } 
  else {
    // Default Erlang C
    rawRequired = Math.ceil(A) + 1;
    for (let N = rawRequired; N < 1000; N++) {
      const pc = calculateErlangC(N, A);
      const asa = pc * aht / (N - A || 1);
      const sla = (1 - pc * Math.exp(-(N - A) * params.targetSlaSeconds / aht)) * 100;

      if (sla >= params.targetSlaPercent && (A / N * 100) <= params.occupancyTarget) {
        rawRequired = N;
        slaPercent = Math.min(100, Math.max(0, sla));
        asaSeconds = Math.max(1, asa);
        break;
      }
    }
  }

  // 2. Adjust for Maximum Occupancy targets
  let occupancyAdjusted = rawRequired;
  const currentOccupancy = occupancyAdjusted > 0 ? (A / occupancyAdjusted) * 100 : 0;
  if (currentOccupancy > params.occupancyTarget && A > 0) {
    occupancyAdjusted = Math.ceil(A / (params.occupancyTarget / 100));
  }

  // 3. Adjust for Total Shrinkage (e.g. breaks, coaching, sickness)
  // formula: Staff = Required / (1 - Shrinkage%)
  const shrinkageFactor = params.shrinkage / 100;
  let shrinkageAdjusted = Math.ceil(occupancyAdjusted / (1 - shrinkageFactor));

  // 4. Adjust for Schedule Adherence Targets
  // formula: Staff = ShrinkageStaff / (Adherence%)
  const adherenceFactor = params.adherence / 100;
  let finalRequired = Math.ceil(shrinkageAdjusted / (adherenceFactor || 1));

  return {
    rawRequired,
    occupancyAdjusted,
    shrinkageAdjusted,
    finalRequired,
    slaPercent,
    asaSeconds,
    abandonRate
  };
}

/**
 * Monte Carlo simulator to test shift schedules and staffing allocations against Poisson distribution call arrivals.
 */
export function simulateStaffingSchedule(
  volume: number, // Forecast volume
  aht: number,    // Forecast AHT
  agentsAvailable: number,
  params: ChannelParams,
  runs: number = 200
): {
  simulatedSla: number;
  simulatedAsa: number;
  abandonRate: number;
  occupancy: number;
} {
  if (volume <= 0 || agentsAvailable <= 0) {
    return { simulatedSla: 100, simulatedAsa: 0, abandonRate: 0, occupancy: 0 };
  }

  // Poisson lambda = expected arrivals in 30 minutes
  const lambda = volume;
  const targetTimeSec = params.targetSlaSeconds;
  
  let totalSlaMet = 0;
  let totalWaitTime = 0;
  let totalAbandoned = 0;
  let busySecondsSum = 0;

  // Simple event-driven simulation for 1 interval (1800 seconds)
  // Agents are modeled with busy timetables
  for (let r = 0; r < runs; r++) {
    // Generate Poisson randomized count
    let arrivalsCount = 0;
    let L = Math.exp(-lambda);
    let k = 0;
    let p = 1.0;
    do {
      k++;
      p *= Math.random();
    } while (p > L && k < 1000);
    arrivalsCount = k - 1;

    if (arrivalsCount === 0) continue;

    // Generate random arrival times uniformly within 1800 seconds
    const arrivals = Array.from({ length: arrivalsCount }, () => Math.random() * 1800).sort((a,b)=>a-b);
    const agentBusyUntil = Array(agentsAvailable).fill(0);

    arrivals.forEach(arrivalTime => {
      // Find earliest available agent
      agentBusyUntil.sort((a,b)=>a-b);
      const earliestAgentTime = agentBusyUntil[0];

      let waitTime = 0;
      if (earliestAgentTime > arrivalTime) {
        waitTime = earliestAgentTime - arrivalTime;
      }

      // Check patience
      const patience = -180 * Math.log(Math.random() + 0.0001); // Exponential patience (avg 180s)
      if (waitTime > patience) {
        totalAbandoned++;
        return; // Abandoned call
      }

      // Handled call
      totalWaitTime += waitTime;
      if (waitTime <= targetTimeSec) {
        totalSlaMet++;
      }

      const callDuration = aht * (0.7 + Math.random() * 0.6); // Randomized handle time
      const startTime = Math.max(arrivalTime, earliestAgentTime);
      agentBusyUntil[0] = startTime + callDuration;

      // Add busy time
      busySecondsSum += Math.min(1800, startTime + callDuration) - Math.min(1800, startTime);
    });
  }

  const simulatedVolume = volume * runs;
  const simulatedHandled = simulatedVolume - totalAbandoned;

  const simulatedSla = simulatedHandled > 0 ? (totalSlaMet / simulatedHandled) * 100 : 100;
  const simulatedAsa = simulatedHandled > 0 ? (totalWaitTime / simulatedHandled) : 0;
  const abandonRate = simulatedVolume > 0 ? (totalAbandoned / simulatedVolume) * 100 : 0;
  const occupancy = Math.min(99.5, (busySecondsSum / (agentsAvailable * 1800 * runs)) * 100);

  return {
    simulatedSla,
    simulatedAsa: Math.round(simulatedAsa * 10) / 10,
    abandonRate: Math.round(abandonRate * 10) / 10,
    occupancy: Math.round(occupancy * 10) / 10
  };
}
