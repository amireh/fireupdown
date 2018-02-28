const { assert } = require('chai')
const { up, down, ref } = require('../')
const {
  __promiseOf: promiseOf,
  __applySerially: applySerially
} = require('../')

describe('fireupdown::up', function() {
  it('invokes functions in the same stage concurrently in the order of definition', function() {
    const track = createCallTracker()

    return up([
      {
        up: track('first', () => new Promise(resolve => {
          setTimeout(resolve, 1)
        }))
      },
      {
        up: track('second', () => {})
      }
    ])().then(() => {
      assert.deepEqual(track.calls, [ 'first', 'second', 'second:DONE', 'first:DONE' ])
    })
  })

  it('invokes functions in different stages serially', function() {
    const track = createCallTracker()

    return up([
      {
        rc: 2,
        up: track('rc[2][0]', () => {})
      },
      {
        up: track('rc[0][0]', () => {})
      },
      {
        rc: 5,
        up: track('rc[5][0]', () => {})
      },
      {
        rc: 5,
        up: track('rc[5][1]', () => {})
      },
    ])().then(() => {
      assert.deepEqual(track.calls, [
        'rc[0][0]', 'rc[0][0]:DONE',
        'rc[2][0]', 'rc[2][0]:DONE',
        'rc[5][0]',
        'rc[5][1]',
        'rc[5][0]:DONE',
        'rc[5][1]:DONE',
      ])
    })
  })

  it('passes arguments to functions', function(done) {
    const params = {}

    up([
      {
        up: (a, b) => {
          assert.deepEqual(a, '1')
          assert.deepEqual(b, params)

          done()
        }
      }
    ])('1', params)
  })

  it('maintains a reference to return values', function() {
    return up([
      {
        up: () => ({ foo: '1' })
      }
    ])().then(state => {
      assert.deepEqual(state, { foo: '1' })
    })
  })

  it('aggregates all returned refs', function() {
    return up([
      {
        up: () => ({ foo: 0 })
      },
      {
        up: () => ({ bar: 0 })
      },
      {
        rc: 1,
        up: state => ({ foo: state.foo + 1 })
      }
    ])().then(state => {
      assert.deepEqual(state, { bar: 0, foo: 1 })
    })
  })

  it('passes refs to next stages', function() {
    return up([
      {
        up: () => ({ foo: 0 })
      },
      {
        rc: 1,
        up: state => ({ foo: state.foo + 1 })
      }
    ])().then(state => {
      assert.deepEqual(state, { foo: 1 })
    })
  })
})

describe('fireupdown::down', function() {
  it('invokes functions in the same stage concurrently in the order of definition', function() {
    const track = createCallTracker()

    return down([
      {
        down: track('first', () => new Promise(resolve => {
          setTimeout(resolve, 1)
        }))
      },
      {
        down: track('second', () => {})
      }
    ])().then(() => {
      assert.deepEqual(track.calls, [ 'first', 'second', 'second:DONE', 'first:DONE' ])
    })
  })

  it('invokes functions in different stages serially (in reverse order)', function() {
    const track = createCallTracker()

    return down([
      {
        rc: 2,
        down: track('rc[2][0]', () => {})
      },
      {
        rc: -2,
        down: track('rc[-2][0]', () => {})
      },
      {
        rc: 5,
        down: track('rc[5][0]', () => {})
      },
      {
        rc: 5,
        down: track('rc[5][1]', () => {})
      },
    ])().then(() => {
      assert.deepEqual(track.calls, [
        'rc[5][0]',
        'rc[5][1]',
        'rc[5][0]:DONE',
        'rc[5][1]:DONE',
        'rc[2][0]', 'rc[2][0]:DONE',
        'rc[-2][0]', 'rc[-2][0]:DONE',
      ])
    })
  })

  it('passes arguments to hooks', function(done) {
    const params = {}

    down([
      {
        down: (a, b) => {
          assert.deepEqual(a, '1')
          assert.deepEqual(b, params)

          done()
        }
      }
    ])('1', params)
  })

  it('maintains a reference to return values', function() {
    return down([
      {
        down: () => ({ foo: '1' })
      }
    ])().then(state => {
      assert.deepEqual(state, { foo: '1' })
    })
  })

  it('aggregates all returned refs', function() {
    return down([
      {
        down: state => ({ foo: state.foo - 2 })
      },
      {
        rc: 1,
        down: () => ({ bar: 0 })
      },
      {
        rc: 2,
        down: () => ({ foo: 2 })
      }
    ])().then(state => {
      assert.deepEqual(state, { bar: 0, foo: 0 })
    })
  })

  it('passes refs to previous stages', function() {
    return down([
      {
        down: state => ({ foo: state.foo - 2 })
      },
      {
        rc: 1,
        down: () => ({ foo: 1 })
      }
    ])().then(state => {
      assert.deepEqual(state, { foo: -1 })
    })
  })

  // it('ignores changes to state through refs', function() {
  //   const initialState = {}

  //   return down([
  //     {
  //       down: () => ({ foo: '1' })
  //     }
  //   ])(initialState).then(result => {
  //     assert.equal(result, undefined)
  //   })
  // })
})

describe('fireupdown::ref', function() {
  it('associates a value with a name', function() {
    const value = {}

    assert.deepEqual(ref('foo')(value), { foo: value })
  })
})

describe('applySerially - failure propagation', function() {
  const subject = applySerially

  it('propagates immediate failures in the first stage', function() {
    const error = new Error('hello')

    return subject([
      [
        () => {
          throw error
        }
      ]
    ], []).then(bail, function(thrownError) {
      assert.equal(thrownError, error)
    })
  })

  it('propagates immediate failures in later stages', function() {
    const error = new Error('hello')

    return subject([
      [],

      [
        () => {
          throw error
        }
      ]
    ], []).then(bail, function(thrownError) {
      assert.equal(thrownError, error)
    })
  })

  it('propagates exceptions in promise blocks in the first stage', function() {
    const error = new Error('hello')

    return subject([
      [
        () => {
          return new Promise(function() {
            throw error
          })
        }
      ]
    ], []).then(bail, function(thrownError) {
      assert.equal(thrownError, error)
    })
  })

  it('propagates exceptions in promise blocks in later stages', function() {
    const error = new Error('hello')

    return subject([
      [],

      [
        () => {
          return new Promise(function() {
            throw error
          })
        }
      ]
    ], []).then(bail, function(thrownError) {
      assert.equal(thrownError, error)
    })
  })

  it('propagates promise rejections in the first stage', function() {
    const error = new Error('hello')

    return subject([
      [
        () => Promise.reject(error)
      ]
    ], []).then(bail, function(thrownError) {
      assert.equal(thrownError, error)
    })
  })

  it('propagates promise rejections in later stages', function() {
    const error = new Error('hello')

    return subject([
      [],

      [
        () => Promise.reject(error)
      ]
    ], []).then(bail, function(thrownError) {
      assert.equal(thrownError, error)
    })
  })
})

const bail = () => { throw new Error('SHOULD NOT HAVE PASSED!') }
const createCallTracker = () => {
  const calls = []
  const callArgs = []

  const trackCall = (name, f) => (...args) => {
    calls.push(name)
    callArgs.push(args)

    return promiseOf(f(...args)).then(x => {
      calls.push(`${name}:DONE`)

      return x
    })
  }

  trackCall.calls = calls
  trackCall.callArgs = callArgs

  return trackCall
}
