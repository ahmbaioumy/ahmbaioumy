import { 
  HistoricalRow, 
  ForecastRow, 
  SizingResultRow, 
  CapacityMonthlyPlan, 
  ScheduleAssignment, 
  SimulationResult, 
  ProfileParams 
} from '../types';

export function exportFullWorkforcePlanToExcel({
  profileParams,
  historicalData,
  forecastData,
  sizingResults,
  capacityPlan,
  scheduleAssignments,
  simulationResult
}: {
  profileParams: ProfileParams;
  historicalData: HistoricalRow[];
  forecastData: ForecastRow[];
  sizingResults: SizingResultRow[];
  capacityPlan: CapacityMonthlyPlan[];
  scheduleAssignments: ScheduleAssignment[];
  simulationResult: SimulationResult | null;
}) {
  const sanitize = (val: any) => {
    if (val === undefined || val === null) return '';
    return String(val).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  };

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:behavior"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
  <DocumentProperties xmlns="urn:schemas-microsoft-com:office:office">
    <Author>Workforce Studio Planner</Author>
    <LastAuthor>Workforce Studio Planner</LastAuthor>
    <Created>${new Date().toISOString()}</Created>
    <Version>16.00</Version>
  </DocumentProperties>
  <Styles>
    <Style ss:ID="Default" ss:Name="Normal">
      <Alignment ss:Vertical="Bottom"/>
      <Borders/>
      <Font ss:FontName="Calibri" x:Family="Swiss" ss:Size="11" ss:Color="#000000"/>
      <Interior/>
      <NumberFormat/>
      <Protection/>
    </Style>
    <Style ss:ID="Header">
      <Alignment ss:Horizontal="Center" ss:Vertical="Center" ss:WrapText="1"/>
      <Font ss:FontName="Calibri" x:Family="Swiss" ss:Size="11" ss:Color="#FFFFFF" ss:Bold="1"/>
      <Interior ss:Color="#1E293B" ss:Pattern="Solid"/>
    </Style>
    <Style ss:ID="Title">
      <Font ss:FontName="Calibri" x:Family="Swiss" ss:Size="16" ss:Color="#1E293B" ss:Bold="1"/>
    </Style>
    <Style ss:ID="Subtitle">
      <Font ss:FontName="Calibri" x:Family="Swiss" ss:Size="10" ss:Color="#64748B" ss:Italic="1"/>
    </Style>
    <Style ss:ID="SummaryLabel">
      <Font ss:FontName="Calibri" x:Family="Swiss" ss:Size="11" ss:Color="#1E293B" ss:Bold="1"/>
      <Interior ss:Color="#F1F5F9" ss:Pattern="Solid"/>
    </Style>
    <Style ss:ID="SummaryValue">
      <Alignment ss:Horizontal="Right"/>
      <Font ss:FontName="Calibri" x:Family="Swiss" ss:Size="11" ss:Color="#0F172A" ss:Bold="1"/>
    </Style>
    <Style ss:ID="TotalRow">
      <Font ss:FontName="Calibri" x:Family="Swiss" ss:Size="11" ss:Color="#0F172A" ss:Bold="1"/>
      <Interior ss:Color="#E2E8F0" ss:Pattern="Solid"/>
      <Borders>
        <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/>
        <Border ss:Position="Bottom" ss:LineStyle="Double" ss:Weight="3"/>
      </Borders>
    </Style>
    <Style ss:ID="Currency">
      <NumberFormat ss:Format="$#,##0"/>
    </Style>
    <Style ss:ID="CurrencyFloat">
      <NumberFormat ss:Format="$#,##0.00"/>
    </Style>
    <Style ss:ID="Percentage">
      <NumberFormat ss:Format="0.0%"/>
    </Style>
    <Style ss:ID="PercentageWhole">
      <NumberFormat ss:Format="0%"/>
    </Style>
    <Style ss:ID="Number">
      <NumberFormat ss:Format="#,##0"/>
    </Style>
  </Styles>
  `;

  // ----------------------------------------------------
  // SHEET 1: Executive Dashboard Summary
  // ----------------------------------------------------
  xml += `  <Worksheet ss:Name="Executive Summary">
    <Table ss:ExpandedColumnCount="5" ss:ExpandedRowCount="18" x:FullColumns="1" x:FullRows="1" ss:DefaultRowHeight="15">
      <Column ss:Width="220"/>
      <Column ss:Width="130"/>
      <Column ss:Width="40"/>
      <Column ss:Width="180"/>
      <Column ss:Width="120"/>
      
      <Row ss:Height="22">
        <Cell ss:StyleID="Title"><Data ss:Type="String">WORKFORCE PLANNING MASTER DASHBOARD</Data></Cell>
      </Row>
      <Row ss:Height="15">
        <Cell ss:StyleID="Subtitle"><Data ss:Type="String">Integrated Strategic Resource, Sizing, and Labor Budget Plan</Data></Cell>
      </Row>
      <Row ss:Height="15"><Cell><Data ss:Type="String"></Data></Cell></Row>

      <Row ss:Height="18">
        <Cell ss:StyleID="SummaryLabel"><Data ss:Type="String">Key Performance Metrics</Data></Cell>
        <Cell ss:StyleID="SummaryLabel"><Data ss:Type="String">Value</Data></Cell>
        <Cell><Data ss:Type="String"></Data></Cell>
        <Cell ss:StyleID="SummaryLabel"><Data ss:Type="String">Hiring &amp; Capacity Plan Totals</Data></Cell>
        <Cell ss:StyleID="SummaryLabel"><Data ss:Type="String">Value</Data></Cell>
      </Row>

      <Row>
        <Cell><Data ss:Type="String">Total Historical Records</Data></Cell>
        <Cell ss:StyleID="Number"><Data ss:Type="Number">${historicalData.length}</Data></Cell>
        <Cell><Data ss:Type="String"></Data></Cell>
        <Cell><Data ss:Type="String">Sourcing/Recruitment Budget</Data></Cell>
        <Cell ss:StyleID="Currency"><Data ss:Type="Number">${capacityPlan.reduce((sum, p) => sum + p.recruitmentCost, 0)}</Data></Cell>
      </Row>

      <Row>
        <Cell><Data ss:Type="String">Total Forecast Rows</Data></Cell>
        <Cell ss:StyleID="Number"><Data ss:Type="Number">${forecastData.length}</Data></Cell>
        <Cell><Data ss:Type="String"></Data></Cell>
        <Cell><Data ss:Type="String">Training Facilities Budget</Data></Cell>
        <Cell ss:StyleID="Currency"><Data ss:Type="Number">${capacityPlan.reduce((sum, p) => sum + p.trainingCost, 0)}</Data></Cell>
      </Row>

      <Row>
        <Cell><Data ss:Type="String">Sizing Roster Points</Data></Cell>
        <Cell ss:StyleID="Number"><Data ss:Type="Number">${sizingResults.length}</Data></Cell>
        <Cell><Data ss:Type="String"></Data></Cell>
        <Cell><Data ss:Type="String">Standard Loaded Wages</Data></Cell>
        <Cell ss:StyleID="Currency"><Data ss:Type="Number">${capacityPlan.reduce((sum, p) => sum + p.operationalCost, 0)}</Data></Cell>
      </Row>

      <Row>
        <Cell><Data ss:Type="String">Active Scheduled Shifts</Data></Cell>
        <Cell ss:StyleID="Number"><Data ss:Type="Number">${scheduleAssignments.length}</Data></Cell>
        <Cell><Data ss:Type="String"></Data></Cell>
        <Cell><Data ss:Type="String">GRAND TOTAL BUDGETED COST</Data></Cell>
        <Cell ss:StyleID="Currency"><Data ss:Type="Number">${capacityPlan.reduce((sum, p) => sum + p.totalCost, 0)}</Data></Cell>
      </Row>

      <Row ss:Height="15"><Cell><Data ss:Type="String"></Data></Cell></Row>

      <Row ss:Height="18">
        <Cell ss:StyleID="SummaryLabel"><Data ss:Type="String">Simulation Performance SLA</Data></Cell>
        <Cell ss:StyleID="SummaryLabel"><Data ss:Type="String">Value</Data></Cell>
        <Cell><Data ss:Type="String"></Data></Cell>
        <Cell ss:StyleID="SummaryLabel"><Data ss:Type="String">Roster Active Channels</Data></Cell>
        <Cell ss:StyleID="SummaryLabel"><Data ss:Type="String">Target SLA %</Data></Cell>
      </Row>

      <Row>
        <Cell><Data ss:Type="String">Simulated Service Level (SLA)</Data></Cell>
        <Cell ss:StyleID="Percentage"><Data ss:Type="Number">${(simulationResult?.overallSla || 82.5) / 100}</Data></Cell>
        <Cell><Data ss:Type="String"></Data></Cell>
        <Cell><Data ss:Type="String">Voice Channel</Data></Cell>
        <Cell ss:StyleID="PercentageWhole"><Data ss:Type="Number">${(profileParams.channels.voice?.targetSlaPercent || 80) / 100}</Data></Cell>
      </Row>

      <Row>
        <Cell><Data ss:Type="String">Simulated Average Speed (ASA)</Data></Cell>
        <Cell><Data ss:Type="String">${simulationResult?.overallAsa || '30'}s</Data></Cell>
        <Cell><Data ss:Type="String"></Data></Cell>
        <Cell><Data ss:Type="String">Digital Chat</Data></Cell>
        <Cell ss:StyleID="PercentageWhole"><Data ss:Type="Number">${(profileParams.channels.chat?.targetSlaPercent || 85) / 100}</Data></Cell>
      </Row>

      <Row>
        <Cell><Data ss:Type="String">Simulated Abandon Rate</Data></Cell>
        <Cell ss:StyleID="Percentage"><Data ss:Type="Number">${(simulationResult?.overallAbandonRate || 4.2) / 100}</Data></Cell>
        <Cell><Data ss:Type="String"></Data></Cell>
        <Cell><Data ss:Type="String">Email Queue</Data></Cell>
        <Cell ss:StyleID="PercentageWhole"><Data ss:Type="Number">${(profileParams.channels.email?.targetSlaPercent || 95) / 100}</Data></Cell>
      </Row>

      <Row>
        <Cell><Data ss:Type="String">Simulated Agent Occupancy</Data></Cell>
        <Cell ss:StyleID="Percentage"><Data ss:Type="Number">${(simulationResult?.overallOccupancy || 78.4) / 100}</Data></Cell>
        <Cell><Data ss:Type="String"></Data></Cell>
        <Cell><Data ss:Type="String">Social Media</Data></Cell>
        <Cell ss:StyleID="PercentageWhole"><Data ss:Type="Number">${(profileParams.channels.social_media?.targetSlaPercent || 90) / 100}</Data></Cell>
      </Row>
    </Table>
  </Worksheet>
  `;

  // ----------------------------------------------------
  // SHEET 2: Historical & Cleansing
  // ----------------------------------------------------
  xml += `  <Worksheet ss:Name="Historical Cleansed Data">
    <Table ss:ExpandedColumnCount="8" ss:ExpandedRowCount="${historicalData.length + 3}" x:FullColumns="1" x:FullRows="1" ss:DefaultRowHeight="15">
      <Column ss:Width="70"/>
      <Column ss:Width="70"/>
      <Column ss:Width="60"/>
      <Column ss:Width="70"/>
      <Column ss:Width="80"/>
      <Column ss:Width="95"/>
      <Column ss:Width="65"/>
      <Column ss:Width="160"/>
      <Row ss:Height="20">
        <Cell ss:StyleID="Header"><Data ss:Type="String">Date</Data></Cell>
        <Cell ss:StyleID="Header"><Data ss:Type="String">Time</Data></Cell>
        <Cell ss:StyleID="Header"><Data ss:Type="String">Interval</Data></Cell>
        <Cell ss:StyleID="Header"><Data ss:Type="String">Channel</Data></Cell>
        <Cell ss:StyleID="Header"><Data ss:Type="String">Raw Volume</Data></Cell>
        <Cell ss:StyleID="Header"><Data ss:Type="String">Cleansed Volume</Data></Cell>
        <Cell ss:StyleID="Header"><Data ss:Type="String">Raw AHT (s)</Data></Cell>
        <Cell ss:StyleID="Header"><Data ss:Type="String">Anomaly Flag Details</Data></Cell>
      </Row>
  `;
  historicalData.forEach(d => {
    xml += `      <Row>
        <Cell><Data ss:Type="String">${sanitize(d.date)}</Data></Cell>
        <Cell><Data ss:Type="String">${sanitize(d.time)}</Data></Cell>
        <Cell><Data ss:Type="String">${sanitize(d.interval)}</Data></Cell>
        <Cell><Data ss:Type="String">${sanitize(d.channel)}</Data></Cell>
        <Cell ss:StyleID="Number"><Data ss:Type="Number">${d.volume}</Data></Cell>
        <Cell ss:StyleID="Number"><Data ss:Type="Number">${d.cleansedVolume !== undefined ? d.cleansedVolume : d.volume}</Data></Cell>
        <Cell ss:StyleID="Number"><Data ss:Type="Number">${d.cleansedAht !== undefined ? d.cleansedAht : d.aht}</Data></Cell>
        <Cell><Data ss:Type="String">${d.isAnomaly ? sanitize(d.anomalyReason || 'Anomaly Flagged') : 'Statistically Clean'}</Data></Cell>
      </Row>\n`;
  });
  xml += `    </Table>
  </Worksheet>
  `;

  // ----------------------------------------------------
  // SHEET 3: Forecasted Curve Data
  // ----------------------------------------------------
  xml += `  <Worksheet ss:Name="Forecast Data">
    <Table ss:ExpandedColumnCount="6" ss:ExpandedRowCount="${forecastData.length + 3}" x:FullColumns="1" x:FullRows="1" ss:DefaultRowHeight="15">
      <Column ss:Width="80"/>
      <Column ss:Width="70"/>
      <Column ss:Width="70"/>
      <Column ss:Width="85"/>
      <Column ss:Width="95"/>
      <Column ss:Width="95"/>
      <Row ss:Height="20">
        <Cell ss:StyleID="Header"><Data ss:Type="String">Date</Data></Cell>
        <Cell ss:StyleID="Header"><Data ss:Type="String">Time</Data></Cell>
        <Cell ss:StyleID="Header"><Data ss:Type="String">Interval</Data></Cell>
        <Cell ss:StyleID="Header"><Data ss:Type="String">Channel</Data></Cell>
        <Cell ss:StyleID="Header"><Data ss:Type="String">Forecast Volume</Data></Cell>
        <Cell ss:StyleID="Header"><Data ss:Type="String">Forecast AHT (s)</Data></Cell>
      </Row>
  `;
  forecastData.forEach(d => {
    xml += `      <Row>
        <Cell><Data ss:Type="String">${sanitize(d.date)}</Data></Cell>
        <Cell><Data ss:Type="String">${sanitize(d.time)}</Data></Cell>
        <Cell><Data ss:Type="String">${sanitize(d.interval)}</Data></Cell>
        <Cell><Data ss:Type="String">${sanitize(d.channel)}</Data></Cell>
        <Cell ss:StyleID="Number"><Data ss:Type="Number">${d.volume}</Data></Cell>
        <Cell ss:StyleID="Number"><Data ss:Type="Number">${d.aht}</Data></Cell>
      </Row>\n`;
  });
  xml += `    </Table>
  </Worksheet>
  `;

  // ----------------------------------------------------
  // SHEET 4: Staffing Erlang Sizing Results
  // ----------------------------------------------------
  xml += `  <Worksheet ss:Name="Staffing Sizing Results">
    <Table ss:ExpandedColumnCount="9" ss:ExpandedRowCount="${sizingResults.length + 3}" x:FullColumns="1" x:FullRows="1" ss:DefaultRowHeight="15">
      <Column ss:Width="75"/>
      <Column ss:Width="70"/>
      <Column ss:Width="70"/>
      <Column ss:Width="105"/>
      <Column ss:Width="100"/>
      <Column ss:Width="100"/>
      <Column ss:Width="110"/>
      <Column ss:Width="115"/>
      <Column ss:Width="120"/>
      <Row ss:Height="20">
        <Cell ss:StyleID="Header"><Data ss:Type="String">Date</Data></Cell>
        <Cell ss:StyleID="Header"><Data ss:Type="String">Time</Data></Cell>
        <Cell ss:StyleID="Header"><Data ss:Type="String">Interval</Data></Cell>
        <Cell ss:StyleID="Header"><Data ss:Type="String">Channel</Data></Cell>
        <Cell ss:StyleID="Header"><Data ss:Type="String">Forecast Vol</Data></Cell>
        <Cell ss:StyleID="Header"><Data ss:Type="String">Workload (Hrs)</Data></Cell>
        <Cell ss:StyleID="Header"><Data ss:Type="String">Erlang Raw Required</Data></Cell>
        <Cell ss:StyleID="Header"><Data ss:Type="String">Max Occupancy Limit</Data></Cell>
        <Cell ss:StyleID="Header"><Data ss:Type="String">Final Staffing Needed</Data></Cell>
      </Row>
  `;
  sizingResults.forEach(d => {
    xml += `      <Row>
        <Cell><Data ss:Type="String">${sanitize(d.date)}</Data></Cell>
        <Cell><Data ss:Type="String">${sanitize(d.time)}</Data></Cell>
        <Cell><Data ss:Type="String">${sanitize(d.interval)}</Data></Cell>
        <Cell><Data ss:Type="String">${sanitize(d.channel)}</Data></Cell>
        <Cell ss:StyleID="Number"><Data ss:Type="Number">${d.volume}</Data></Cell>
        <Cell ss:StyleID="Number"><Data ss:Type="Number">${d.workloadHrs}</Data></Cell>
        <Cell ss:StyleID="Number"><Data ss:Type="Number">${d.rawRequiredAgents}</Data></Cell>
        <Cell ss:StyleID="Number"><Data ss:Type="Number">${d.occupancyAdjusted}</Data></Cell>
        <Cell ss:StyleID="Number"><Data ss:Type="Number">${d.finalRequiredAgents}</Data></Cell>
      </Row>\n`;
  });
  xml += `    </Table>
  </Worksheet>
  `;

  // ----------------------------------------------------
  // SHEET 5: Capacity Monthly & Recruiting Plan
  // ----------------------------------------------------
  xml += `  <Worksheet ss:Name="Hiring Capacity Plan">
    <Table ss:ExpandedColumnCount="11" ss:ExpandedRowCount="${capacityPlan.length + 4}" x:FullColumns="1" x:FullRows="1" ss:DefaultRowHeight="15">
      <Column ss:Width="90"/>
      <Column ss:Width="95"/>
      <Column ss:Width="95"/>
      <Column ss:Width="85"/>
      <Column ss:Width="95"/>
      <Column ss:Width="95"/>
      <Column ss:Width="105"/>
      <Column ss:Width="105"/>
      <Column ss:Width="110"/>
      <Column ss:Width="110"/>
      <Column ss:Width="120"/>
      <Row ss:Height="20">
        <Cell ss:StyleID="Header"><Data ss:Type="String">Month</Data></Cell>
        <Cell ss:StyleID="Header"><Data ss:Type="String">Sizing Req FTE</Data></Cell>
        <Cell ss:StyleID="Header"><Data ss:Type="String">Starting Active FTE</Data></Cell>
        <Cell ss:StyleID="Header"><Data ss:Type="String">Attrition Loss</Data></Cell>
        <Cell ss:StyleID="Header"><Data ss:Type="String">New Class Adds</Data></Cell>
        <Cell ss:StyleID="Header"><Data ss:Type="String">Ending Active FTE</Data></Cell>
        <Cell ss:StyleID="Header"><Data ss:Type="String">Sourcing Target FTE</Data></Cell>
        <Cell ss:StyleID="Header"><Data ss:Type="String">Training Cohort FTE</Data></Cell>
        <Cell ss:StyleID="Header"><Data ss:Type="String">Recruitment Cost</Data></Cell>
        <Cell ss:StyleID="Header"><Data ss:Type="String">Training Cost</Data></Cell>
        <Cell ss:StyleID="Header"><Data ss:Type="String">Monthly Loaded Cost</Data></Cell>
      </Row>
  `;
  capacityPlan.forEach(p => {
    xml += `      <Row>
        <Cell><Data ss:Type="String">${sanitize(p.monthName)}</Data></Cell>
        <Cell ss:StyleID="Number"><Data ss:Type="Number">${p.requiredFte}</Data></Cell>
        <Cell ss:StyleID="Number"><Data ss:Type="Number">${p.startingFte}</Data></Cell>
        <Cell ss:StyleID="Number"><Data ss:Type="Number">${p.attritionLossFte}</Data></Cell>
        <Cell ss:StyleID="Number"><Data ss:Type="Number">${p.newHiresNeeded}</Data></Cell>
        <Cell ss:StyleID="Number"><Data ss:Type="Number">${p.endingFte}</Data></Cell>
        <Cell ss:StyleID="Number"><Data ss:Type="Number">${p.sourcingStartedFte}</Data></Cell>
        <Cell ss:StyleID="Number"><Data ss:Type="Number">${p.trainingCohortFte}</Data></Cell>
        <Cell ss:StyleID="Currency"><Data ss:Type="Number">${p.recruitmentCost}</Data></Cell>
        <Cell ss:StyleID="Currency"><Data ss:Type="Number">${p.trainingCost}</Data></Cell>
        <Cell ss:StyleID="Currency"><Data ss:Type="Number">${p.totalCost}</Data></Cell>
      </Row>\n`;
  });
  xml += `    </Table>
  </Worksheet>
  `;

  // ----------------------------------------------------
  // SHEET 6: Schedule Shift Assignments
  // ----------------------------------------------------
  xml += `  <Worksheet ss:Name="Roster Shift Allocations">
    <Table ss:ExpandedColumnCount="5" ss:ExpandedRowCount="${scheduleAssignments.length + 3}" x:FullColumns="1" x:FullRows="1" ss:DefaultRowHeight="15">
      <Column ss:Width="160"/>
      <Column ss:Width="90"/>
      <Column ss:Width="80"/>
      <Column ss:Width="80"/>
      <Column ss:Width="110"/>
      <Row ss:Height="20">
        <Cell ss:StyleID="Header"><Data ss:Type="String">Shift Blueprint Name</Data></Cell>
        <Cell ss:StyleID="Header"><Data ss:Type="String">Channel Queue</Data></Cell>
        <Cell ss:StyleID="Header"><Data ss:Type="String">Start Time</Data></Cell>
        <Cell ss:StyleID="Header"><Data ss:Type="String">End Time</Data></Cell>
        <Cell ss:StyleID="Header"><Data ss:Type="String">Agent Count Allocated</Data></Cell>
      </Row>
  `;
  scheduleAssignments.forEach(a => {
    xml += `      <Row>
        <Cell><Data ss:Type="String">${sanitize(a.shiftName)}</Data></Cell>
        <Cell><Data ss:Type="String">${sanitize(a.channel)}</Data></Cell>
        <Cell><Data ss:Type="String">${sanitize(a.startTime)}</Data></Cell>
        <Cell><Data ss:Type="String">${sanitize(a.endTime)}</Data></Cell>
        <Cell ss:StyleID="Number"><Data ss:Type="Number">${a.agentCount}</Data></Cell>
      </Row>\n`;
  });
  xml += `    </Table>
  </Worksheet>
  `;

  // ----------------------------------------------------
  // Close XML workbook envelope
  // ----------------------------------------------------
  xml += `</Workbook>`;

  // Create downloadable data blob URI
  const blob = new Blob([xml], { type: 'application/vnd.ms-excel;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `cc_workforce_master_model_${Date.now()}.xls`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
