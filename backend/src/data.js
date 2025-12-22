// backend/src/data.js

export const users = [
  { username: "admin", password: "admin123", role: "Admin" },
  { username: "player", password: "player123", role: "Player" },
];

/**
 * Player (estructura recomendada)
 * @typedef {Object} Player
 * @property {number} id
 * @property {string} name
 * @property {number} points
 */
export const players = [
  { id: 1, name: "Juan", points: 18 },
  { id: 2, name: "Mario", points: 12 },
  { id: 3, name: "Laura", points: 9 },
];

export const matchesByPlayerId = {
  1: [
    { date: "2025-12-01", vs: "Mario", result: "2-0" },
    { date: "2025-12-10", vs: "Laura", result: "1-2" },
  ],
  2: [{ date: "2025-12-01", vs: "Juan", result: "0-2" }],
  3: [{ date: "2025-12-10", vs: "Juan", result: "2-1" }],
};
