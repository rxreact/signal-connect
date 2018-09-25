import { SignalGraph } from '@rxreact/signal'
import { withViewModel, ObservableMap, SubjectMap, Difference, ActionMap } from '@rxreact/core'
import React from 'react'

type Output<PrimarySignalsType, DerivedSignalsType> = {
  <K1 extends keyof PrimarySignalsType>(key: K1): ObservableMap<PrimarySignalsType>[K1]
  <K2 extends keyof DerivedSignalsType>(key: K2): ObservableMap<DerivedSignalsType>[K2]
  <K1 extends keyof PrimarySignalsType, K2 extends keyof DerivedSignalsType>(key: K1 | K2):
    | ObservableMap<PrimarySignalsType>[K1]
    | ObservableMap<DerivedSignalsType>[K2]
}
const connectFromFunction = <PrimarySignalsType, DerivedSignalsType, S, A>(
  signalGraph: SignalGraph<PrimarySignalsType, DerivedSignalsType>,
  mapOutputsToInputProps: (
    outputs: Output<PrimarySignalsType, DerivedSignalsType>
  ) => ObservableMap<S>,
  mapInputsToOutputProps: (
    inputs: <K1 extends keyof PrimarySignalsType>(key: K1) => SubjectMap<PrimarySignalsType>[K1]
  ) => SubjectMap<A>
): (<T extends S & ActionMap<A>>(
  WrappedComponent: React.ComponentType<T>
) => React.ComponentClass<Difference<T, S & ActionMap<A>>>) => {
  const inputs = mapOutputsToInputProps(signalGraph.output)
  const outputs = mapInputsToOutputProps(signalGraph.input)
  return withViewModel({ outputs, inputs })
}

export const connect = connectFromFunction
