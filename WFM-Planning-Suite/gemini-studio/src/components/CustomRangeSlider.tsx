import React, { useState } from 'react';

interface CustomRangeSliderProps {
  label: string;
  min: number;
  max: number;
  step?: number;
  value: number;
  onChange: (val: number) => void;
  unit?: string;
  desc?: string;
  accentClass?: string;
}

export default function CustomRangeSlider({
  label,
  min: defaultMin,
  max: defaultMax,
  step = 1,
  value,
  onChange,
  unit = '',
  desc,
  accentClass = 'accent-blue-600'
}: CustomRangeSliderProps) {
  const [customMin, setCustomMin] = useState<number>(defaultMin);
  const [customMax, setCustomMax] = useState<number>(defaultMax);
  const [isEditingLimits, setIsEditingLimits] = useState<boolean>(false);

  return (
    <div className="space-y-1.5" id={`slider-${label.toLowerCase().replace(/[^a-z0-9]/g, '-')}`}>
      <div className="flex justify-between items-center text-xs">
        <span className="text-gray-500 font-medium">{label}</span>
        <div className="flex items-center space-x-2">
          <span className="font-semibold text-gray-700">{value}{unit}</span>
          <button
            type="button"
            onClick={() => setIsEditingLimits(!isEditingLimits)}
            className="text-[9px] text-blue-500 hover:underline font-semibold cursor-pointer"
          >
            {isEditingLimits ? 'done' : 'set limit'}
          </button>
        </div>
      </div>
      <input
        type="range"
        min={customMin}
        max={customMax}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className={`w-full ${accentClass} cursor-pointer`}
      />
      
      {isEditingLimits && (
        <div className="flex items-center justify-between gap-3 text-[10px] text-gray-400 bg-gray-50 p-1.5 rounded-md border border-gray-100 animate-fadeIn">
          <div className="flex items-center space-x-1">
            <span>Min:</span>
            <input
              type="number"
              step={step}
              value={customMin}
              onChange={(e) => {
                const val = parseFloat(e.target.value) || 0;
                setCustomMin(val);
                if (value < val) onChange(val);
              }}
              className="w-12 text-center text-[10px] border border-gray-200 rounded-sm py-0.5 outline-none font-medium bg-white"
            />
          </div>
          <div className="flex items-center space-x-1">
            <span>Max:</span>
            <input
              type="number"
              step={step}
              value={customMax}
              onChange={(e) => {
                const val = parseFloat(e.target.value) || 0;
                setCustomMax(val);
                if (value > val) onChange(val);
              }}
              className="w-12 text-center text-[10px] border border-gray-200 rounded-sm py-0.5 outline-none font-medium bg-white"
            />
          </div>
        </div>
      )}
      {desc && <p className="text-[10px] text-gray-400 leading-relaxed mt-0.5">{desc}</p>}
    </div>
  );
}
