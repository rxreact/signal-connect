import { SignalGraph } from '@rxreact/signal'
import {
  withViewModel,
  ObservableMap,
  SubjectMap,
  Difference,
  ActionMap,
  ViewModelFactory
} from '@rxreact/core'
import React from 'react'
import { Observable } from 'rxjs'

type Output<PrimarySignalsType, DerivedSignalsType> = {
  <K1 extends keyof PrimarySignalsType>(key: K1): ObservableMap<PrimarySignalsType>[K1]
  <K2 extends keyof DerivedSignalsType>(key: K2): ObservableMap<DerivedSignalsType>[K2]
  <K1 extends keyof PrimarySignalsType, K2 extends keyof DerivedSignalsType>(key: K1 | K2):
    | ObservableMap<PrimarySignalsType>[K1]
    | ObservableMap<DerivedSignalsType>[K2]
}
const connectFromFunction = <PrimarySignalsType, DerivedSignalsType, S, A, P = {}>(
  signalGraph: SignalGraph<PrimarySignalsType, DerivedSignalsType>,
  mapOutputsToProps: (
    outputs: Output<PrimarySignalsType, DerivedSignalsType>,
    ownProps: Observable<P>
  ) => ObservableMap<S>,
  mapInputsToProps?: (
    inputs: <K1 extends keyof PrimarySignalsType>(key: K1) => SubjectMap<PrimarySignalsType>[K1],
    ownProps: Observable<P>
  ) => SubjectMap<A>
): (<T extends S & ActionMap<A> & P>(
  WrappedComponent: React.ComponentType<T>
) => React.ComponentClass<Difference<T, S & ActionMap<A>> & P>) => {
  const vmFactory: ViewModelFactory<S, A, P> = (props: Observable<P>) => {
    const inputs = mapOutputsToProps(signalGraph.output, props)
    const outputs = mapInputsToProps ? mapInputsToProps(signalGraph.input, props) : undefined
    return { outputs, inputs }
  }
  return withViewModel<S, A, P>(vmFactory)
}

export const connect = connectFromFunction
