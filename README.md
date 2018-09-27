[![styled with prettier](https://img.shields.io/badge/styled_with-prettier-ff69b4.svg)](https://github.com/prettier/prettier)
[![Greenkeeper badge](https://badges.greenkeeper.io/rxreact/signal-connect.svg)](https://greenkeeper.io/)
[![Build Status](https://travis-ci.org/rxreact/signal-connect.svg?branch=master)](https://travis-ci.org/rxreact/signal-connect)
[![Coverage Status](https://coveralls.io/repos/github/rxreact/signal-connect/badge.svg?branch=master)](https://coveralls.io/github/rxreact/signal-connect?branch=master)

Development Sponsored By:  
[![Carbon Five](./assets/C5_final_logo_horiz.png)](http://www.carbonfive.com)

# Signal Connect

Connect your signal graphs to ReactJs Components!

## Installation

In your project:

```
npm install @rxreact/signal-connect --save
```

or

```
yarn add @rxreact/signal-connect
```

RxJS and React are peer dependencies and need to be installed seperately

## Usage

Define a signal graph using the [@rxreact/signal](https://github.com/rxreact/signal) library.

Here's lets use the example from that project's README of a Signal Graph to represent a login component and user authentication.

```typescript
  const signalGraph = new SignalGraphBuilder<SignalsType, Dependencies>()
    .define(addPrimary('username$'))
    .define(
      addPrimary('password$'),
      addPrimary('submitButton$'),
      addDependency('api', api),
      addDerived('loginAttempts$', makeLoginAttempts, 'submitButton$', 'username$', 'password$'),
      addDerived('loginResponses$', makeLoginResponses, 'loginAttempts$', 'api'),
      addDerived('loginInProgress$', makeLoginInProgress, 'loginAttempts$', 'loginResponses$'),
      addDerived('loginSuccesses$', makeLoginSuccesses, 'loginResponses$'),
      addDerived('loginFailures$', makeLoginFailures, 'loginResponses$'),
      addDerived(
        'loginFailureMessage$',
        makeLoginFailureMessage,
        'loginAttempts$',
        'loginFailures$'
      ),
      addDerived('authStatus$', makeAuthStatus, 'loginSuccesses$')
    )
    .initializeWith({
      loginInProgress$: false,
      loginFailureMessage$: '',
      username$: '',
      password$: '',
      authStatus$: { status: 'unauthorized' }
    })
    .build()
```

Now, let's say we have a login form component:

```typescript
const LoginForm: React.SFC<{
  loginInProgress: boolean
  loginFailureMessage: string
  username: string
  password: string
  submitButton: () => undefined
  usernameChanged: (username: string) => undefined
  passwordChanged: (password: string) => undefined
}> = ({
  loginInProgress,
  loginFailureMessage,
  username,
  password,
  submitButton,
  usernameChanged,
  passwordChanged
}) => {
  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    submitButton()
    event.preventDefault()
  }
  return (
    <form onSubmit={onSubmit}>
      <label htmlFor="username">User name:</label>
      <input
        type="text"
        id="username"
        name="username"
        value={username}
        disabled={loginInProgress}
        onChange={event => usernameChanged(event.target.value)}
      />
      <label htmlFor="password">Password:</label>
      <input
        type="text"
        id="password"
        name="password"
        value={password}
        disabled={loginInProgress}
        onChange={event => passwordChanged(event.target.value)}
      />
      <div>{loginFailureMessage}</div>
      <button disabled={loginInProgress} type="submit">
        Submit
      </button>
    </form>
  )
}
```

We want to connect the signals from our signal graph to props on this component. Here's where we use `@rxreact/signal-connect`. `@rxreact/signal-connect` exports a single function called `connect`:

```typescript
import { connect } from '@rxreact/signal-connect'
```

`connect` behaves a lot like `connect` from `react-redux`, creating data props that get updated from the latest values in the graph, and functions as props that we can call to send data back to the graph. The simples use of `connect` looks like this:

```typescript
const ConnectedComponent = connect(
  signalGraph,
  {
    loginInProgress: 'loginInProgress$',
    loginFailureMessage: 'loginFailureMessage$',
    username: 'username$',
    password: 'password$'
  },
  {
    usernameChanged: 'username$',
    passwordChanged: 'password$',
    submitButton: 'submitButton$'
  }
)(LoginForm)
```

The first object specifies data props that get updated as signals from the graph emit new values. (think `mapStateToProps`) The second objects specifies primary signals we use as entry points to send data back into the graph. In this case, the login form gets `usernameChanged`, `passwordChanged`, and `submitButton` as props. Each prop is a function, and when it's called (taking a signal parameter) it gets sent into the primary signals in the graph! (think `mapDispatchToProps`)

### More Complex Usage

You may later want to have more control over assembling your props. In this case, you can can actually pass functions instead of objects, which get a single parameter than can be used to extract signals from the graph.

```typescript
const ConnectedComponent = connect(
  signalGraph,
  outputs => ({
    loginInProgress: outputs('loginInProgress$'),
    loginFailureMessage: outputs('loginFailureMessage$'),
    username: outputs('username$'),
    password: outputs('password$')
  }),
  inputs => ({
    usernameChanged: inputs('username$'),
    passwordChanged: inputs('password$'),
    submitButton: inputs('submitButton$')
  })
)(LoginForm)
```

You also have access to an observable that represents the external props passed to the component in these functions:

```typescript
const ConnectedProtectedAreaExtended = connect(
  authResourceGraph,
  (outputs, ownProps$: Observable<{ override: boolean }>) => {
    const authStatus$ = combineLatest(ownProps$, outputs('authStatus$')).pipe(
      map(
        ([{ override }, authStatus]): AuthStatus =>
          override ? { status: 'authorized', token: 'a token' } : authStatus
      )
    )
    const protectedResource$ = combineLatest(ownProps$, outputs('protected$')).pipe(
      map(
        ([{ override }, protectedResource]) =>
          override ? 'auth overridden' : protectedResource
      )
    )
    return {
      authStatus: authStatus$,
      protectedResource: protectedResource$
    }
  }
```

However, ideally you can use the simple version of `connect` in most cases, because signal graphs are flexible, and you can create many of your custom pieces/selections of data inside the graph itself!


### Caveat Emptor

These libraries are still in development, use at your own risk

## Enjoy!
