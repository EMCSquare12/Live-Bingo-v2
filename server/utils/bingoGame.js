const COLUMNS = {
    B: { min: 1, max: 15 },
    I: { min: 16, max: 30 },
    N: { min: 31, max: 45 },
    G: { min: 46, max: 60 },
    O: { min: 61, max: 75 }
};

const generateBingoCard = () => {
    const card = [];
    const getNumbers = (min, max, count) => {
        const nums = new Set();
        while (nums.size < count) {
            nums.add(Math.floor(Math.random() * (max - min + 1)) + min);
        }
        return Array.from(nums);
    };

    const b = getNumbers(COLUMNS.B.min, COLUMNS.B.max, 5);
    const i = getNumbers(COLUMNS.I.min, COLUMNS.I.max, 5);
    const n = getNumbers(COLUMNS.N.min, COLUMNS.N.max, 4);
    const g = getNumbers(COLUMNS.G.min, COLUMNS.G.max, 5);
    const o = getNumbers(COLUMNS.O.min, COLUMNS.O.max, 5);

    for (let r = 0; r < 5; r++) {
        const row = [];
        row.push(b[r]);
        row.push(i[r]);
        if (r === 2) {
            row.push(0);
        } else {
            row.push(n[r > 2 ? r - 1 : r]);
        }
        row.push(g[r]);
        row.push(o[r]);
        card.push(row);
    }
    return card;
};
const calculateRemaining = (playerMarks, winningPattern) => {

    const missing = winningPattern.filter(index => !playerMarks.includes(index));
    return missing.length;
};

// Check for Win
const checkWin = (playerMarks, winningPattern) => {
    return winningPattern.every(index => playerMarks.includes(index));
};

exports = { generateBingoCard, calculateRemaining, checkWin };