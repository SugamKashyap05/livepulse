export {};
const { main } = require("./verify-feed-sources.js")

main({ apply: true }).catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
