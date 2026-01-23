package calc

import (
	"math"
	"time"
)

// CalculationMethod defines the angles for Fajr and Isha
type CalculationMethod struct {
	FajrAngle float64
	IshaAngle float64
	AsrFactor float64 // 1 for Standard (Shafi, Maliki, Hanbali), 2 for Hanafi
}

var (
	MethodMWL  = CalculationMethod{FajrAngle: 18.0, IshaAngle: 17.0, AsrFactor: 1}
	MethodISNA = CalculationMethod{FajrAngle: 15.0, IshaAngle: 15.0, AsrFactor: 1}
	MethodEgypt = CalculationMethod{FajrAngle: 19.5, IshaAngle: 17.5, AsrFactor: 1}
	MethodMakkah = CalculationMethod{FajrAngle: 18.5, IshaAngle: 90.0, AsrFactor: 1} // Isha fixed 90min after Maghrib (approx)
)

type PrayerTimes struct {
	Fajr    time.Time
	Sunrise time.Time
	Dhuhr   time.Time
	Asr     time.Time
	Maghrib time.Time
	Isha    time.Time
}

func d2r(d float64) float64 { return d * math.Pi / 180.0 }
func r2d(r float64) float64 { return r * 180.0 / math.Pi }

func fixHour(h float64) float64 {
	h = h - 24.0*math.Floor(h/24.0)
	if h < 0 {
		h += 24.0
	}
	return h
}

// Calculate computes prayer times for a given date and location
func Calculate(date time.Time, lat, long float64, tzOffset float64, method CalculationMethod) PrayerTimes {
	// Julian Day
	year := float64(date.Year())
	month := float64(date.Month())
	day := float64(date.Day())

	if month <= 2 {
		year -= 1
		month += 12
	}
	a := math.Floor(year / 100)
	b := 2 - a + math.Floor(a/4)
	jd := math.Floor(365.25*(year+4716)) + math.Floor(30.6001*(month+1)) + day + b - 1524.5

	// Sun Coordinates
	d := jd - 2451545.0
	g := 357.529 + 0.98560028*d
	q := 280.459 + 0.98564736*d
	// l := fixHour(q) // Mean Longitude not needed directly if using L

	// Ecliptic coordinates
	gRad := d2r(g)
	// qRad := d2r(q)
	
	// Mean Longitude (L)
	L := q + 1.915*math.Sin(gRad) + 0.020*math.Sin(2*gRad)
	L = fixHour(L) // degrees
	LRad := d2r(L)

	// Obliquity (e)
	e := 23.439 - 0.00000036*d
	eRad := d2r(e)

	// Right Ascension (RA)
	ra := r2d(math.Atan2(math.Cos(eRad)*math.Sin(LRad), math.Cos(LRad))) / 15.0
	ra = fixHour(ra)

	// Declination (delta)
	sinDelta := math.Sin(eRad) * math.Sin(LRad)
	cosDelta := math.Sqrt(1 - sinDelta*sinDelta)
	// delta := math.Asin(sinDelta)

	// Equation of Time (EqT)
	EqT := q/15.0 - ra

	// Dhuhr
	Dhuhr := 12.0 - EqT + (tzOffset - long/15.0)

	// Sun Altitude Helper
	calcTime := func(angle float64, direction int) float64 {
		// direction: 1 for rising/afternoon (Asr), -1 for rising/morning (Fajr/Sunrise)? 
		// Actually formula: T = Dhuhr +/- T(alpha)
		// T(alpha) = 1/15 * acos(...)
		
		// angle is altitude.
		// For Fajr/Isha angle is depression so negative.
		// For Sunrise/Sunset angle is -0.833 approx.
		
		sinAlpha := math.Sin(d2r(angle))
		cosPhi := math.Cos(d2r(lat))
		// cosDelta calculated above
		
		term := (sinAlpha - math.Sin(d2r(lat))*sinDelta) / (cosPhi * cosDelta)
		if term > 1 || term < -1 {
			return 0 // Extreme latitude
		}
		t := r2d(math.Acos(term)) / 15.0
		
		if direction < 0 {
			return Dhuhr - t
		}
		return Dhuhr + t
	}

	// Fajr (Morning Twilight)
	fajrTime := calcTime(-method.FajrAngle, -1)
	
	// Sunrise
	sunriseTime := calcTime(-0.8333, -1)

	// Maghrib (Sunset)
	maghribTime := calcTime(-0.8333, 1)

	// Isha (Evening Twilight)
	ishaTime := calcTime(-method.IshaAngle, 1)
	
	// Asr
	// cot(A) = cot(B) + factor. B = abs(lat - delta)
	// delta = asin(sinDelta)
	delta := math.Asin(sinDelta)
	// latRad := d2r(lat)
	
	// Shadow Length at noon = abs(lat - delta)
	// Altitude A = acot(factor + tan(abs(lat-delta)))
	
	phi := d2r(lat)
	
	// Noon altitude
	// altitudeNoon := 90 - r2d(math.Abs(phi - delta))
	// shadowNoon := 1/math.Tan(d2r(altitudeNoon)) -> actually simply math.Tan(math.Abs(phi-delta))
	
	shadowNoon := math.Tan(math.Abs(phi - delta))
	shadowAsr := method.AsrFactor + shadowNoon
	altAsr := r2d(math.Atan(1.0/shadowAsr))
	
	asrTime := calcTime(altAsr, 1)

	// Convert float hours to time.Time
	toTime := func(h float64) time.Time {
		h = fixHour(h)
		hours := int(h)
		mins := int((h - float64(hours)) * 60)
		secs := int(((h - float64(hours)) * 60 - float64(mins)) * 60)
		
		return time.Date(date.Year(), date.Month(), date.Day(), hours, mins, secs, 0, date.Location())
	}
	
	return PrayerTimes{
		Fajr:    toTime(fajrTime),
		Sunrise: toTime(sunriseTime),
		Dhuhr:   toTime(Dhuhr),
		Asr:     toTime(asrTime),
		Maghrib: toTime(maghribTime),
		Isha:    toTime(ishaTime),
	}
}
