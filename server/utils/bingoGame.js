const COLUMNS = {
    B: { min: 1, max: 15 },
    I: { min: 16, max: 30 },
    N: { min: 31, max: 45 },
    G: { min: 46, max: 60 },
    O: { min: 61, max: 75 }
};

const generateBingoCard = () => {
    const card = [[], [], [], [], []]; // 5 rows
    const ranges = [
        [1, 15], [16, 30], [31, 45], [46, 60], [61, 75]
    ];

    for (let col = 0; col < 5; col++) {
        const [min, max] = ranges[col];
        const nums = [];
        while (nums.length < 5) {
            const r = Math.floor(Math.random() * (max - min + 1)) + min;
            if (!nums.includes(r)) nums.push(r);
        }
        nums.sort((a, b) => a - b);
        for (let row = 0; row < 5; row++) {
            card[row][col] = nums[row];
        }
    }
    card[2][2] = 0; // Center Free Space
    return card;
};

const calculateRemaining = (markedIndices, winningPattern) => {
    const remaining = winningPattern.filter(index => !markedIndices.includes(index));
    return remaining.length;
};

// Check for Win
const checkWin = (markedIndices, winningPattern) => {
    return winningPattern.every(index => markedIndices.includes(index));
};

module.exports = { generateBingoCard, calculateRemaining, checkWin };