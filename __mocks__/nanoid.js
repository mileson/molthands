// Manual mock for nanoid (ESM-only module incompatible with Jest)
const nanoid = (size = 21) => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-'
  let result = 'mock_'
  for (let i = 0; i < size - 5; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result.slice(0, size)
}

module.exports = { nanoid }
