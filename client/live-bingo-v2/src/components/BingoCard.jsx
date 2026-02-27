import React from "react";

const getBingoHeaderColor = (letter) => {
  switch (letter) {
    case "B":
      return "text-red-400";
    case "I":
      return "text-yellow-400";
    case "N":
      return "text-green-400";
    case "G":
      return "text-blue-400";
    case "O":
      return "text-purple-400";
    default:
      return "text-gray-400";
  }
};

const BingoCard = ({ matrix, markedIndices, onCellClick, isSpectator }) => {
  // Flatten the 2D matrix for easier mapping (0-24)
  const flatMatrix = matrix.flat();

  return (
    <div className="bg-gray-800 p-4 rounded-xl shadow-2xl max-w-md w-full mx-auto">
      {/* HEADER: B I N G O */}
      <div className="grid grid-cols-5 gap-2 mb-2">
        {["B", "I", "N", "G", "O"].map((letter, index) => (
          <div
            key={index}
            className="flex items-center justify-center font-black text-3xl md:text-5xl drop-shadow-md"
          >
            <span className={getBingoHeaderColor(letter)}>{letter}</span>
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
