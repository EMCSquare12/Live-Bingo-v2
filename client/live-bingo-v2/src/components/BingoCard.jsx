import React from "react";

const BingoCard = ({ matrix, markedIndices, onCellClick, isSpectator }) => {
  // Flatten the 2D matrix for easier mapping (0-24)
  const flatMatrix = matrix.flat();

  return (
    <div className="bg-gray-800 p-4 rounded-xl shadow-2xl max-w-md w-full mx-auto">
      {/* HEADER: B I N G O */}
      <div className="grid grid-cols-5 gap-2 mb-2 text-center">
        {["B", "I", "N", "G", "O"].map((letter) => (
          <div
            key={letter}
            className="font-black text-3xl text-gray-500 drop-shadow-md"
          >
            {letter}
          </div>
        ))}
      </div>

      {/* THE GRID */}
      <div className="grid grid-cols-5 gap-2 aspect-square">
        {flatMatrix.map((num, index) => {
          const isMarked = markedIndices.includes(index);
          const isFreeSpace = index === 12; // Center cell

          return (
            <button
              key={index}
              disabled={isSpectator || (isFreeSpace && isMarked)} // Disable if spectator or already marked free space
              onClick={() => onCellClick(index, num)}
              className={`
                relative flex items-center justify-center rounded-lg font-bold text-xl md:text-2xl transition-all duration-200
                ${
                  isFreeSpace
                    ? "bg-yellow-500 text-black shadow-[inset_0_0_10px_rgba(0,0,0,0.2)]" // Free Space Style
                    : isMarked
                      ? "bg-pink-600 text-white scale-95 shadow-inner" // Marked Style
                      : "bg-gray-100 text-gray-800 hover:bg-white hover:-translate-y-1 shadow-md" // Default Style
                }
              `}
            >
              {/* Star Icon for Free Space */}
              {isFreeSpace ? "★" : num}

              {/* "Daub" Effect (Circle overlay) */}
              {isMarked && (
                <span className="absolute inset-0 bg-black/10 rounded-lg animate-ping-once" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default BingoCard;
