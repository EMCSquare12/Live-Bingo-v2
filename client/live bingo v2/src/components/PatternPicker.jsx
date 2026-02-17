import React, { useState, useEffect } from "react";

const PatternPicker = ({ onPatternChange }) => {
  // Default to Blackout (all indices 0-24)
  const [selectedIndices, setSelectedIndices] = useState(
    Array.from({ length: 25 }, (_, i) => i),
  );

  const toggleCell = (index) => {
    if (selectedIndices.includes(index)) {
      setSelectedIndices(selectedIndices.filter((i) => i !== index));
    } else {
      setSelectedIndices([...selectedIndices, index]);
    }
  };

  useEffect(() => {
    onPatternChange(selectedIndices);
  }, [selectedIndices, onPatternChange]);

  return (
    <div className="flex flex-col items-center gap-2">
      <p className="text-sm text-gray-400">
        Click cells to set winning pattern (Green = Required)
      </p>

      <div className="grid grid-cols-5 gap-1 mb-2">
        {Array.from({ length: 25 }).map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => toggleCell(i)}
            className={`w-8 h-8 rounded text-xs font-bold border 
              ${
                selectedIndices.includes(i)
                  ? "bg-green-500 border-green-600 text-white"
                  : "bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600"
              }`}
          >
            {i === 12 ? "FREE" : ""}
          </button>
        ))}
      </div>

      {/* Presets */}
      <div className="flex gap-2 text-xs">
        <button
          type="button"
          className="px-2 py-1 bg-blue-600 rounded hover:bg-blue-500"
          onClick={() =>
            setSelectedIndices(Array.from({ length: 25 }, (_, i) => i))
          }
        >
          Blackout
        </button>
        <button
          type="button"
          className="px-2 py-1 bg-purple-600 rounded hover:bg-purple-500"
          onClick={() => setSelectedIndices([0, 4, 12, 20, 24])}
        >
          X Shape
        </button>
      </div>
    </div>
  );
};

export default PatternPicker;
