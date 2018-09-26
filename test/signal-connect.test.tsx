import { SignalGraphBuilder, addPrimary, addDependency, addDerived } from '@rxreact/signal'
import { withLatestFrom, flatMap, map, filter } from 'rxjs/operators'
import { merge, pipe, Observable, combineLatest } from 'rxjs'
import {
  LoginResponse,
  LoginSuccess,
  LoginFailure,
  API,
  api,
  LoginForm,
  ProtectedArea,
  AuthStatus,
  Authorized,
  CORRECT_USERNAME,
  CORRECT_PASSWORD,
  AUTH_RESOURCE
} from './fixtures'
import { connect } from '../src/signal-connect'
import React from 'react'
import { shallow } from 'enzyme'

const makeGraphs = () => {
  const signalGraph = new SignalGraphBuilder<
    {
      username$: string
      password$: string
      submitButton$: void
      loginAttempts$: [void, string, string]
      loginResponses$: LoginResponse
      loginInProgress$: boolean
      loginSuccesses$: LoginSuccess
      loginFailures$: LoginFailure
      loginFailureMessage$: string
      authStatus$: AuthStatus
    },
    {
      api: API
    }
  >()
    .define(addPrimary('username$'))
    .define(
      addPrimary('password$'),
      addPrimary('submitButton$'),
      addDependency('api', api),
      addDerived(
        'loginAttempts$',
        (submitButton$, username$, password$) =>
          submitButton$.pipe(withLatestFrom(username$, password$)),
        'submitButton$',
        'username$',
        'password$'
      ),
      addDerived(
        'loginResponses$',
        (loginAttempts$, api) =>
          loginAttempts$.pipe(
            flatMap(([_, username, password]) => api.login({ username, password }))
          ),
        'loginAttempts$',
        'api'
      ),
      addDerived(
        'loginInProgress$',
        (loginAttempts$, loginResponses$) =>
          merge(loginAttempts$.pipe(map(_ => true)), loginResponses$.pipe(map(_ => false))),
        'loginAttempts$',
        'loginResponses$'
      ),
      addDerived(
        'loginSuccesses$',
        filter(
          (loginResponse: LoginResponse): loginResponse is LoginSuccess =>
            loginResponse.status === 'success'
        ),
        'loginResponses$'
      ),
      addDerived(
        'loginFailures$',
        filter(
          (loginResponse: LoginResponse): loginResponse is LoginFailure =>
            loginResponse.status === 'failure'
        ),
        'loginResponses$'
      ),
      addDerived(
        'loginFailureMessage$',
        (loginAttempts$, loginFailures$) =>
          merge(
            loginAttempts$.pipe(map(_ => '')),
            loginFailures$.pipe(map(({ error: { message } }) => message))
          ),
        'loginAttempts$',
        'loginFailures$'
      ),
      addDerived(
        'authStatus$',
        map<LoginSuccess, AuthStatus>(({ data: { userToken } }: LoginSuccess) => ({
          status: 'authorized',
          token: userToken
        })),
        'loginSuccesses$'
      )
    )
    .initializeWith({
      loginInProgress$: false,
      loginFailureMessage$: '',
      username$: '',
      password$: '',
      authStatus$: { status: 'unauthorized' }
    })
    .build()

  const authResourceGraph = new SignalGraphBuilder<
    {
      userToken$: string
      authStatus$: AuthStatus
      protected$: string
    },
    { api: API }
  >()
    .define(
      addPrimary('authStatus$'),
      addDerived(
        'userToken$',
        pipe(
          filter(
            (authStatus: AuthStatus): authStatus is Authorized => authStatus.status === 'authorized'
          ),
          map(authorized => authorized.token)
        ),
        'authStatus$'
      ),
      addDependency('api', api),
      addDerived(
        'protected$',
        (userToken$, api) =>
          userToken$.pipe(flatMap(userToken => api.protectedResource.get(userToken))),
        'userToken$',
        'api'
      )
    )
    .initializeWith({
      protected$: ''
    })
    .build()

  authResourceGraph.connect(
    'authStatus$',
    signalGraph,
    'authStatus$'
  )
  return { signalGraph, authResourceGraph }
}

describe('connect', () => {
  describe('connecting from function', () => {
    describe('with functions only using the graph', () => {
      const { signalGraph, authResourceGraph } = makeGraphs()
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
      const connected = shallow(<ConnectedComponent />)
      const rendered = connected.dive()

      const ConnectedProtectedArea = connect(
        authResourceGraph,
        outputs => ({
          authStatus: outputs('authStatus$'),
          protectedResource: outputs('protected$')
        })
      )(ProtectedArea)
      const connectedAuth = shallow(<ConnectedProtectedArea override={false} />)
      const renderedAuth = connectedAuth.dive()

      it('propogates properties correctly', async () => {
        // simulate an incorrect login

        rendered.find('#username').simulate('change', {
          target: { value: 'incorrect user' },
          preventDefault: () => undefined
        })
        rendered.find('#password').simulate('change', {
          target: { value: 'incorrect password', preventDefault: () => undefined }
        })
        rendered.find('form').simulate('submit', { preventDefault: () => undefined })
        // make sure login completes
        await new Promise(resolve => {
          signalGraph.output('loginResponses$').subscribe(() => {
            resolve()
          })
        })
        connected.update()
        const newRendered = connected.dive()
        // verify password update
        expect(newRendered.text()).toContain('incorrect username/password')
      })

      it('renders props across connected graphs', async () => {
        // auth area should start unauthorized
        expect(renderedAuth.text()).toContain('Not authorized')

        // simulate an correct login
        rendered.find('#username').simulate('change', {
          target: { value: CORRECT_USERNAME },
          preventDefault: () => undefined
        })
        rendered.find('#password').simulate('change', {
          target: { value: CORRECT_PASSWORD, preventDefault: () => undefined }
        })
        rendered.find('form').simulate('submit', { preventDefault: () => undefined })
        // make sure login completes
        await new Promise(resolve => {
          signalGraph.output('loginResponses$').subscribe(() => {
            resolve()
          })
        })
        // make sure protected resource is fetched
        await new Promise(resolve => {
          authResourceGraph.output('protected$').subscribe(resource => {
            if (resource === AUTH_RESOURCE) {
              resolve()
            }
          })
        })
        connectedAuth.update()
        const newRenderedAuth = connectedAuth.dive()
        // verify password update
        expect(newRenderedAuth.text()).toContain(AUTH_RESOURCE)
      })
    })
    describe('with functions that use ownProps', () => {
      const { authResourceGraph } = makeGraphs()
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
      )(ProtectedArea)
      it("can utilize it's own props with graphs signals", () => {
        const connectedAuth = shallow(<ConnectedProtectedAreaExtended override={false} />)
        const renderedAuth = connectedAuth.dive()
        expect(renderedAuth.text()).toContain('Not authorized')
        connectedAuth.setProps({ override: true })
        connectedAuth.update()
        const newRenderedAuth = connectedAuth.dive()
        expect(newRenderedAuth.text()).toContain('auth overridden')
      })
    })
  })
  describe('connecting with plain objects', () => {
    const { signalGraph, authResourceGraph } = makeGraphs()
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
    const connected = shallow(<ConnectedComponent />)
    const rendered = connected.dive()

    const ConnectedProtectedArea = connect(
      authResourceGraph,
      outputs => ({
        authStatus: outputs('authStatus$'),
        protectedResource: outputs('protected$')
      })
    )(ProtectedArea)
    const connectedAuth = shallow(<ConnectedProtectedArea override={false} />)
    const renderedAuth = connectedAuth.dive()

    it('propogates properties correctly', async () => {
      // simulate an incorrect login

      rendered.find('#username').simulate('change', {
        target: { value: 'incorrect user' },
        preventDefault: () => undefined
      })
      rendered.find('#password').simulate('change', {
        target: { value: 'incorrect password', preventDefault: () => undefined }
      })
      rendered.find('form').simulate('submit', { preventDefault: () => undefined })
      // make sure login completes
      await new Promise(resolve => {
        signalGraph.output('loginResponses$').subscribe(() => {
          resolve()
        })
      })
      connected.update()
      const newRendered = connected.dive()
      // verify password update
      expect(newRendered.text()).toContain('incorrect username/password')
    })

    it('renders props across connected graphs', async () => {
      // auth area should start unauthorized
      expect(renderedAuth.text()).toContain('Not authorized')

      // simulate an correct login
      rendered.find('#username').simulate('change', {
        target: { value: CORRECT_USERNAME },
        preventDefault: () => undefined
      })
      rendered.find('#password').simulate('change', {
        target: { value: CORRECT_PASSWORD, preventDefault: () => undefined }
      })
      rendered.find('form').simulate('submit', { preventDefault: () => undefined })
      // make sure login completes
      await new Promise(resolve => {
        signalGraph.output('loginResponses$').subscribe(() => {
          resolve()
        })
      })
      // make sure protected resource is fetched
      await new Promise(resolve => {
        authResourceGraph.output('protected$').subscribe(resource => {
          if (resource === AUTH_RESOURCE) {
            resolve()
          }
        })
      })
      connectedAuth.update()
      const newRenderedAuth = connectedAuth.dive()
      // verify password update
      expect(newRenderedAuth.text()).toContain(AUTH_RESOURCE)
    })
  })
  describe('connecting with plain object outputs and function inputs', () => {
    const { signalGraph, authResourceGraph } = makeGraphs()
    const ConnectedComponent = connect(
      signalGraph,
      {
        loginInProgress: 'loginInProgress$',
        loginFailureMessage: 'loginFailureMessage$',
        username: 'username$',
        password: 'password$'
      },
      inputs => ({
        usernameChanged: inputs('username$'),
        passwordChanged: inputs('password$'),
        submitButton: inputs('submitButton$')
      })
    )(LoginForm)
    const connected = shallow(<ConnectedComponent />)
    const rendered = connected.dive()

    const ConnectedProtectedArea = connect(
      authResourceGraph,
      outputs => ({
        authStatus: outputs('authStatus$'),
        protectedResource: outputs('protected$')
      })
    )(ProtectedArea)
    const connectedAuth = shallow(<ConnectedProtectedArea override={false} />)
    const renderedAuth = connectedAuth.dive()

    it('propogates properties correctly', async () => {
      // simulate an incorrect login

      rendered.find('#username').simulate('change', {
        target: { value: 'incorrect user' },
        preventDefault: () => undefined
      })
      rendered.find('#password').simulate('change', {
        target: { value: 'incorrect password', preventDefault: () => undefined }
      })
      rendered.find('form').simulate('submit', { preventDefault: () => undefined })
      // make sure login completes
      await new Promise(resolve => {
        signalGraph.output('loginResponses$').subscribe(() => {
          resolve()
        })
      })
      connected.update()
      const newRendered = connected.dive()
      // verify password update
      expect(newRendered.text()).toContain('incorrect username/password')
    })

    it('renders props across connected graphs', async () => {
      // auth area should start unauthorized
      expect(renderedAuth.text()).toContain('Not authorized')

      // simulate an correct login
      rendered.find('#username').simulate('change', {
        target: { value: CORRECT_USERNAME },
        preventDefault: () => undefined
      })
      rendered.find('#password').simulate('change', {
        target: { value: CORRECT_PASSWORD, preventDefault: () => undefined }
      })
      rendered.find('form').simulate('submit', { preventDefault: () => undefined })
      // make sure login completes
      await new Promise(resolve => {
        signalGraph.output('loginResponses$').subscribe(() => {
          resolve()
        })
      })
      // make sure protected resource is fetched
      await new Promise(resolve => {
        authResourceGraph.output('protected$').subscribe(resource => {
          if (resource === AUTH_RESOURCE) {
            resolve()
          }
        })
      })
      connectedAuth.update()
      const newRenderedAuth = connectedAuth.dive()
      // verify password update
      expect(newRenderedAuth.text()).toContain(AUTH_RESOURCE)
    })
  })
  describe('connecting with funtion outputs and plain object inputs', () => {
    const { signalGraph, authResourceGraph } = makeGraphs()
    const ConnectedComponent = connect(
      signalGraph,
      outputs => ({
        loginInProgress: outputs('loginInProgress$'),
        loginFailureMessage: outputs('loginFailureMessage$'),
        username: outputs('username$'),
        password: outputs('password$')
      }),
      {
        usernameChanged: 'username$',
        passwordChanged: 'password$',
        submitButton: 'submitButton$'
      }
    )(LoginForm)
    const connected = shallow(<ConnectedComponent />)
    const rendered = connected.dive()

    const ConnectedProtectedArea = connect(
      authResourceGraph,
      outputs => ({
        authStatus: outputs('authStatus$'),
        protectedResource: outputs('protected$')
      })
    )(ProtectedArea)
    const connectedAuth = shallow(<ConnectedProtectedArea override={false} />)
    const renderedAuth = connectedAuth.dive()

    it('propogates properties correctly', async () => {
      // simulate an incorrect login

      rendered.find('#username').simulate('change', {
        target: { value: 'incorrect user' },
        preventDefault: () => undefined
      })
      rendered.find('#password').simulate('change', {
        target: { value: 'incorrect password', preventDefault: () => undefined }
      })
      rendered.find('form').simulate('submit', { preventDefault: () => undefined })
      // make sure login completes
      await new Promise(resolve => {
        signalGraph.output('loginResponses$').subscribe(() => {
          resolve()
        })
      })
      connected.update()
      const newRendered = connected.dive()
      // verify password update
      expect(newRendered.text()).toContain('incorrect username/password')
    })

    it('renders props across connected graphs', async () => {
      // auth area should start unauthorized
      expect(renderedAuth.text()).toContain('Not authorized')

      // simulate an correct login
      rendered.find('#username').simulate('change', {
        target: { value: CORRECT_USERNAME },
        preventDefault: () => undefined
      })
      rendered.find('#password').simulate('change', {
        target: { value: CORRECT_PASSWORD, preventDefault: () => undefined }
      })
      rendered.find('form').simulate('submit', { preventDefault: () => undefined })
      // make sure login completes
      await new Promise(resolve => {
        signalGraph.output('loginResponses$').subscribe(() => {
          resolve()
        })
      })
      // make sure protected resource is fetched
      await new Promise(resolve => {
        authResourceGraph.output('protected$').subscribe(resource => {
          if (resource === AUTH_RESOURCE) {
            resolve()
          }
        })
      })
      connectedAuth.update()
      const newRenderedAuth = connectedAuth.dive()
      // verify password update
      expect(newRenderedAuth.text()).toContain(AUTH_RESOURCE)
    })
  })
})
