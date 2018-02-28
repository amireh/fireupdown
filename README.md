# fireupdown

Apply sequences of `up` and `down` routines one after another as they finish.
Ideal for initializing and tearing down asynchronous systems.

```javascript
import { up, down } from 'fireupdown'

const systems = [
  // the routing system
  {
    rc: 0,
    up: (config) => startRouter(config).then(router => ({ router })),
    down: ({ router }) => stopRouter(router)
  },

  // the UI system which needs the router to function
  {
    rc: 1,
    up: (config, { router }) => (
      mountUI(router).then(component => ({ component }))
    ),
    down: ({ component }) => (
      unmountUI(component)
    )
  }
]
```

Then you can bring all the systems up where "routing system" (rc = 0) will have to finish before invoking the "UI" system:

```javascript
// bring all systems up
up(systems)({ startingURL: '/' }).then(appState => {
  appState.hasOwnProperty('router')    // => true
  appState.hasOwnProperty('component') // => true
}, startFailure => {

})
```

Later you can bring all the systems down using the `down` routine:

```javascript
down(systems)(appState).then(() => {
  // all systems down
}, stopFailure => {

})
```

## Installation

Get it via NPM:

```shell
npm install --save fireupdown
```

The source is written to work in Node6+, but you may need to transpile it for
older Browsers. It does not use ES6 modules, but requires `Promise` to be
available.

## API

The package exports three symbols: `up`, `down`, and `ref`.

### `.up`

Bring all systems up **starting from the lowest defined RC level**. The
signature is as follows:

```javascript
function up(
  systems: Array.<System>
): function(...Any): Promise.<Object?>
```

Where `System` is defined as:

```javascript
{
  // The "RC" defines the stage in which this system should be initialized.
  // 
  // Systems defined with the same RC are run in parallel and can not access
  // each other's output.
  // 
  // Systems defined with a higher RC will receive the output from systems
  // in lower RCs. 
  // 
  // Defaults to 0.
  ?rc: Number,

  // Hook to bring the system up. (optional)
  ?up: function(...Any): ?Promise.<Object>,

  // Hook to bring the system down. (optional)
  ?down: function(...Any): ?Promise.<Object>
}
```

To pass arguments to the system hooks you simply pass them to the function
returned by `up`. They will be passed in the order you specify.

```javascript
const systems = [
  {
    up: (a, b) => {
      // do something with a, b, or both
    }
  }
]

up(systems)(dep1, dep2)
```

The hooks will also receive a "state" object as the last parameter which is
what is yielded to you when the promise resolves. You can use that object to
maintain references to the system output either for use in the `down` routines
to bring them down or if you need them for your application.

```javascript
const systems = [
  {
    up: (a, state) => {
      // modify the state either for systems in higher RCs or for the end
      // result:
      return { foo: '1' }
    }
  }
]

up(systems)(dep1).then(state => {
  state.foo // => "1"
})
```

The state object is aggregated from all the return values of the hooks you're
running. If the return value is not an object, the behavior is undefined.

```javascript
const systems = [
  {
    up: () => ({ foo: 1 })
  },
  {
    up: () => ({ bar: 1 })
  },
  {
    rc: 1,
    up: state => ({ bar: state.bar + 1 })
  }
]

up(systems)().then(state => {
  state.foo // => 1
  state.bar // => 2
})
```

### `.down`

Bring all systems down **starting from the highest defined RC level**.

This is the inverse operation of [.up](#.up). The signature, parameters and
return values are identical.

### `.ref`

A convenience shortcut for associating the return value of a hook with a
property on the state object.

What it really does is just this:

    const ref = name => value => ({ [name]: value })

The following two hooks are exactly equivalent:

    const up1 = () => produceSomething().then(x => ({ something: x }))
    const up2 = () => produceSomething().then(ref('something'))

## License

MIT