// client/live-bingo-v2/src/components/PatternPicker.jsx
import React, { useState, useEffect } from "react";

const PATTERN_PRESETS = [
  {
    name: "Blackout",
    color: "bg-blue-600 hover:bg-blue-500",
    indices: Array.from({ length: 25 }, (_, i) => i),
  },
  {
    name: "L Shape",
    color: "bg-purple-600 hover:bg-purple-500",
    indices: [0, 5, 10, 15, 20, 21, 22, 23, 24],
  },
  {
    name: "I Shape",
    color: "bg-purple-600 hover:bg-purple-500",
    indices: [0, 1, 2, 3, 4, 7, 17, 20, 21, 22, 23, 24],
  },
  {
    name: "V Shape",
    color: "bg-purple-600 hover:bg-purple-500",
    indices: [0, 4, 5, 9, 10, 14, 16, 18, 22],
  },
  {
    name: "E Shape",
    color: "bg-purple-600 hover:bg-purple-500",
    indices: [0, 1, 2, 3, 4, 5, 10, 11, 13, 14, 15, 20, 21, 22, 23, 24],
  },
];

const PatternPicker = ({ onPatternChange, initialPattern }) => {
  const [selectedIndices, setSelectedIndices] = useState(
    initialPattern && initialPattern.length > 0
      ? initialPattern
      : PATTERN_PRESETS[0].indices,
  );

  useEffect(() => {
    onPatternChange(selectedIndices);
  }, [selectedIndices, onPatternChange]);

  const toggleCell = (index) => {
    // Prevent toggling the FREE cell
    if (index === 12) return;

    setSelectedIndices((prev) =>
      prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index],
    );
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <p className="text-sm text-gray-400">
        Click cells to set winning pattern (Green = Required)
      </p>

      {/* Bingo Grid */}
      <div className="grid grid-cols-5 gap-1">
        {Array.from({ length: 25 }).map((_, i) => {
          const isSelected = selectedIndices.includes(i);
          const isFreeSpace = i === 12;

          return (
            <button
              key={i}
              type="button"
              disabled={isFreeSpace} // Disable the button if it's the free space
              onClick={() => toggleCell(i)}
              className={`w-8 h-8 rounded text-[10px] font-bold border transition-colors ${
                isFreeSpace
                  ? "bg-pink-600 border-pink-700 text-white cursor-not-allowed opacity-80" // Distinct styling for the Free Space
                  : isSelected
                    ? "bg-green-500 border-green-600 text-white"
                    : "bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600"
              }`}
            >
              {isFreeSpace ? "FREE" : ""}
            </button>
          );
        })}
      </div>

      {/* Preset Buttons (2 Rows: 1 Col, then 4 Cols) */}
      <div className="grid grid-cols-4 gap-2 text-xs w-full max-w-[200px]">
        {PATTERN_PRESETS.map(({ name, color, indices }, index) => (
          <button
            key={name}
            type="button"
            className={`px-1 py-1.5 rounded text-white transition-colors truncate ${
              index === 0 ? "col-span-4" : "col-span-1"
            } ${color}`}
            onClick={() => setSelectedIndices(indices)}
            title={name}
          >
            {index === 0 ? name : name.charAt(0)}
          </button>
        ))}
      </div>
    </div>
  );
};

export default PatternPicker;
