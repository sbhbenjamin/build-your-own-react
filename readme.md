# Introduction
Didact is based off Rodrigo Pombo's [Build your own React talk](https://www.youtube.com/watch?v=8Kc2REHdwnQ&ab_channel=GrUSP) given at JSDay 2019. Didact was the given name of choice due to the didactic nature of this project.

React is a tool that enabled me to kick start my web development journey, and I wanted to better understand the tool that I use so often – What's better than building the tool (albeit a simplified version) yourself?

This repo includes the source code of Didact, alongside my comments – which I used to better make sense of what is going on under the hood in React.

## What Didact Covers
Didact covers the following components of React:
- The `createElement` function
- The `render` function
- Concurrent Mode
- Fibers
- Render and Commit Phases
- Reconciliation
- Function Components
- Hooks

# Differences between Didact and React
- Didact walks through the whole tree during the render phase. React instead follows some hints and heuristics to skip entire sub-trees where nothing has changed to improve performance.
- In the commit phase, we are also traversing through the whole tree. React maintains a linked-list with just the fibers that have effects and only visits those fibers.
- Every time we build a new WIP tree, we create objects for each fiber. React recycles the fibers from previous trees.
- When Didact receives a new update from the render phase, it discards the WIP tree and starts again from root. React on the other hand tags each update with an expiration timestamp and uses it to decide which update is newer.
