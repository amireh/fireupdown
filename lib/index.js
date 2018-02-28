const is = (typeName, x) => typeof x === typeName
const merge = x => y => Object.assign({}, x, y)
const mergeAll = list => list.reduce((map, object) => Object.assign(map, object), {})
const promiseOf = x => x && x.then ? x : Promise.resolve(x)
const propIs = (typeName, propName) => x => x && typeof x[propName] === typeName
const prop = propName => x => x[propName]
const tryCatchP = f => {
  try {
    return f()
  }
  catch (e) {
    return Promise.reject(e)
  }
}

// Takes a list of a list of functions (many sequences) and runs them serially,
// one after the other.
//
// It is expected that the functions in each sequence yield Promises but we'll
// coerce them anyway.
//
// (
//   Array.<
//     Array.<
//       function(...Any): ?Promise.<Object>
//     >
//   >
// ): Promise.<Object>
const applySerially = (sequences, args) => {
  const masterSequence = sequences.map(sequence => state => {
    const applications = sequence.map(f => (
      tryCatchP(() =>
        promiseOf(
          f(...args.concat(state))
        ).then(
          merge(state)
        )
      )
    ))

    return Promise.all(applications).then(mergeAll)
  })

  return chainP(masterSequence, 0, {})
}

// Collect systems by their "rc" property into a map where the RCs are keys
//
// (Array.<{ rc?: Number }>): Object.<Number, Array.<Object>>
const collectByRC = systems => systems.reduce(function(map, system) {
  const rc = system.rc || 0

  map[rc] = map[rc] || []
  map[rc].push(system)

  return map
}, {})

function chainP(seq, cursor, x) {
  if (!is('function', seq[cursor])) {
    return Promise.resolve(x)
  }

  return seq[cursor](x).then(y => chainP(seq, cursor + 1, y))
}

/**
 * Bring all systems up starting from the lowest defined RC level.
 *
 *     up([
 *       {
 *         rc: 0,
 *         up: (config) => startRouter(config).then(router => ({ router }))
 *       },
 *       {
 *         rc: 1,
 *         up: (config, { router }) => (
 *           startUI(router).then(component => ({ component }))
 *         )
 *       }
 *     ])({ startingURL: '/' })
 *
 *     // => { router, component }
 *
 * @param  {Array.<fireupdown~System>} systems
 * @return {function(...Any): Promise.<Object>}
 *
 * @typedef {fireupdown~System}
 * @type {Object}
 *
 * @property {Number?} rc
 * @property {function(...Any): Promise.<Object>?} up
 * @property {function(...Any): Promise.<Object>?} down
 */
exports.up = systems => (...args) => {
  const systemsByRC = collectByRC(systems)
  const sequence = Object.keys(systemsByRC).sort().map(rc => (
    systemsByRC[rc].filter(propIs('function', 'up')).map(prop('up'))
  ))

  return applySerially(sequence, args)
}

/**
 * Bring all systems down starting from the highest defined RC level.
 *
 * This is the inverse routine of [[.up]] and executes in the opposite order.
 * The parameters and return values are identical.
 */
exports.down = systems => (...args) => {
  const systemsByRC = collectByRC(systems)
  const sequence = Object.keys(systemsByRC).sort().reverse().map(rc => (
    systemsByRC[rc].filter(propIs('function', 'down')).map(prop('down'))
  ))

  return applySerially(sequence, args)
}

exports.ref = name => x => {
  const object = {}

  object[name] = x

  return object
}

exports.__promiseOf = promiseOf
exports.__applySerially = applySerially
