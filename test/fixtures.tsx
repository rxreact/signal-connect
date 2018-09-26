import React from 'react'

export const CORRECT_USERNAME = 'correct username'
export const CORRECT_PASSWORD = 'correct password'
export const AUTH_RESOURCE = 'my stuff'

export type Unauthorized = {
  status: 'unauthorized'
}
export type Authorized = {
  status: 'authorized'
  token: string
}
export type AuthStatus = Unauthorized | Authorized

export type LoginSuccess = {
  status: 'success'
  data: {
    userToken: string
  }
}
export type LoginFailure = {
  status: 'failure'
  error: {
    message: string
  }
}
export type LoginResponse = LoginSuccess | LoginFailure
export type API = {
  login: (
    loginParams: {
      username: string
      password: string
    }
  ) => Promise<LoginResponse>
  protectedResource: {
    get: (userToken: string) => Promise<string>
  }
}
export const api: API = {
  login: ({ username, password }) => {
    if (username === CORRECT_USERNAME && password === CORRECT_PASSWORD) {
      return new Promise(resolve => {
        resolve({
          status: 'success',
          data: { userToken: 'some token' }
        })
      })
    } else {
      return new Promise(resolve => {
        resolve({
          status: 'failure',
          error: { message: 'incorrect username/password' }
        })
      })
    }
  },
  protectedResource: {
    get: userToken => {
      if (userToken === 'some token') {
        return new Promise(resolve => {
          resolve(AUTH_RESOURCE)
        })
      } else {
        return new Promise(resolve => {
          resolve('not authorized')
        })
      }
    }
  }
}

export const LoginForm: React.SFC<{
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

export const ProtectedArea: React.SFC<{
  authStatus: AuthStatus
  protectedResource: string
  override: boolean
}> = ({ authStatus, protectedResource }) => {
  return authStatus.status === 'authorized' ? (
    <div>{protectedResource}</div>
  ) : (
    <div>Not authorized</div>
  )
}
