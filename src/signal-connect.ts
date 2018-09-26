import { SignalGraph } from '@rxreact/signal'
import {
  withViewModel,
  ObservableMap,
  SubjectMap,
  Difference,
  ActionMap,
  ViewModelFactory,
  ViewModel
} from '@rxreact/core'
import React from 'react'
import { Observable, Subject } from 'rxjs'

type Output<PrimarySignalsType, DerivedSignalsType> = {
  <K1 extends keyof PrimarySignalsType>(key: K1): ObservableMap<PrimarySignalsType>[K1]
  <K2 extends keyof DerivedSignalsType>(key: K2): ObservableMap<DerivedSignalsType>[K2]
  <K1 extends keyof PrimarySignalsType, K2 extends keyof DerivedSignalsType>(key: K1 | K2):
    | ObservableMap<PrimarySignalsType>[K1]
    | ObservableMap<DerivedSignalsType>[K2]
}

interface KeyMap<T> {
  [a: string]: keyof T
}

type VMap<T, O extends KeyMap<T>> = { [K in keyof O]: O[K] extends keyof T ? T[O[K]] : never }

const applyOutputs = <
  PrimarySignalsType,
  DerivedSignalsType,
  KS extends KeyMap<PrimarySignalsType & DerivedSignalsType>
>(
  output: Output<PrimarySignalsType, DerivedSignalsType>,
  outputMap: KS
): ObservableMap<VMap<PrimarySignalsType & DerivedSignalsType, KS>> =>
  (Object.keys(outputMap) as (keyof KS)[]).reduce<
    ObservableMap<VMap<PrimarySignalsType & DerivedSignalsType, KS>>
  >(
    (acc, key) =>
      Object.assign({}, acc, {
        [key]: output(outputMap[key] as keyof PrimarySignalsType | keyof DerivedSignalsType)
      }),
    {} as ObservableMap<VMap<PrimarySignalsType & DerivedSignalsType, KS>>
  )

const applyInputs = <PrimarySignalsType, KA extends KeyMap<PrimarySignalsType>>(
  input: <K1 extends keyof PrimarySignalsType>(key: K1) => SubjectMap<PrimarySignalsType>[K1],
  inputMap: KA
): SubjectMap<VMap<PrimarySignalsType, KA>> =>
  (Object.keys(inputMap) as (keyof KA)[]).reduce<SubjectMap<VMap<PrimarySignalsType, KA>>>(
    (acc, key) =>
      Object.assign({}, acc, {
        [key]: input(inputMap[key] as keyof PrimarySignalsType)
      }),
    {} as SubjectMap<VMap<PrimarySignalsType, KA>>
  )

type ComponentEnhancer<S, A, P = {}> = (<T extends S & ActionMap<A> & P>(
  WrappedComponent: React.ComponentType<T>
) => React.ComponentClass<Difference<T, S & ActionMap<A>> & P>)

type ConnectType = {
  <PrimarySignalsType, DerivedSignalsType, S, A, P = {}>(
    signalGraph: SignalGraph<PrimarySignalsType, DerivedSignalsType>,
    mapOutputsToProps?: ((
      outputs: Output<PrimarySignalsType, DerivedSignalsType>,
      ownProps: Observable<P>
    ) => ObservableMap<S>),
    mapInputsToProps?: ((
      inputs: <K1 extends keyof PrimarySignalsType>(key: K1) => SubjectMap<PrimarySignalsType>[K1],
      ownProps: Observable<P>
    ) => SubjectMap<A>)
  ): ComponentEnhancer<S, A, P>
  <PrimarySignalsType, DerivedSignalsType, S, KA extends KeyMap<PrimarySignalsType>, P = {}>(
    signalGraph: SignalGraph<PrimarySignalsType, DerivedSignalsType>,
    mapOutputsToProps?: (
      outputs: Output<PrimarySignalsType, DerivedSignalsType>,
      ownProps: Observable<P>
    ) => ObservableMap<S>,
    mapInputsToProps?: KA
  ): ComponentEnhancer<S, VMap<PrimarySignalsType, KA>, P>
  <
    PrimarySignalsType,
    DerivedSignalsType,
    KA extends KeyMap<PrimarySignalsType>,
    KS extends KeyMap<PrimarySignalsType & DerivedSignalsType>,
    P = {}
  >(
    signalGraph: SignalGraph<PrimarySignalsType, DerivedSignalsType>,
    mapOutputsToProps?: KS,
    mapInputsToProps?: KA
  ): ComponentEnhancer<
    VMap<PrimarySignalsType & DerivedSignalsType, KS>,
    VMap<PrimarySignalsType, KA>,
    P
  >
  <
    PrimarySignalsType,
    DerivedSignalsType,
    A,
    KS extends KeyMap<PrimarySignalsType & DerivedSignalsType>,
    P = {}
  >(
    signalGraph: SignalGraph<PrimarySignalsType, DerivedSignalsType>,
    mapOutputsToProps?: KS,
    mapInputsToProps?: (
      inputs: <K1 extends keyof PrimarySignalsType>(key: K1) => SubjectMap<PrimarySignalsType>[K1],
      ownProps: Observable<P>
    ) => SubjectMap<A>
  ): ComponentEnhancer<VMap<PrimarySignalsType & DerivedSignalsType, KS>, A, P>
}

const connectSimple = <
  PrimarySignalsType,
  DerivedSignalsType,
  KA extends KeyMap<PrimarySignalsType>,
  KS extends KeyMap<PrimarySignalsType & DerivedSignalsType>
>(
  signalGraph: SignalGraph<PrimarySignalsType, DerivedSignalsType>,
  mapOutputsToProps?: KS,
  mapInputsToProps?: KA
): ComponentEnhancer<
  VMap<PrimarySignalsType & DerivedSignalsType, KS>,
  VMap<PrimarySignalsType, KA>
> => {
  const inputs = mapOutputsToProps && applyOutputs(signalGraph.output, mapOutputsToProps)
  const outputs = mapInputsToProps && applyInputs(signalGraph.input, mapInputsToProps)
  const vm: ViewModel<
    VMap<PrimarySignalsType & DerivedSignalsType, KS>,
    VMap<PrimarySignalsType, KA>
  > = { outputs, inputs }
  return withViewModel(vm)
}

const connectWithOutputsFunc = <
  PrimarySignalsType,
  DerivedSignalsType,
  KA extends KeyMap<PrimarySignalsType>,
  S,
  P = {}
>(
  signalGraph: SignalGraph<PrimarySignalsType, DerivedSignalsType>,
  mapOutputsToProps?: ((
    outputs: Output<PrimarySignalsType, DerivedSignalsType>,
    ownProps: Observable<P>
  ) => ObservableMap<S>),
  mapInputsToProps?: KA
): ComponentEnhancer<S, VMap<PrimarySignalsType, KA>, P> => {
  const vmFactory: ViewModelFactory<S, VMap<PrimarySignalsType, KA>, P> = (
    props: Observable<P>
  ) => {
    const inputs = mapOutputsToProps && mapOutputsToProps(signalGraph.output, props)
    const outputs = mapInputsToProps && applyInputs(signalGraph.input, mapInputsToProps)
    return { outputs, inputs }
  }
  return withViewModel(vmFactory)
}

const connectWithInputsFunc = <
  PrimarySignalsType,
  DerivedSignalsType,
  KS extends KeyMap<PrimarySignalsType & DerivedSignalsType>,
  A,
  P = {}
>(
  signalGraph: SignalGraph<PrimarySignalsType, DerivedSignalsType>,
  mapOutputsToProps?: KS,
  mapInputsToProps?: ((
    inputs: <K1 extends keyof PrimarySignalsType>(key: K1) => SubjectMap<PrimarySignalsType>[K1],
    ownProps: Observable<P>
  ) => SubjectMap<A>)
): ComponentEnhancer<VMap<PrimarySignalsType & DerivedSignalsType, KS>, A, P> => {
  const vmFactory: ViewModelFactory<VMap<PrimarySignalsType & DerivedSignalsType, KS>, A, P> = (
    props: Observable<P>
  ) => {
    const inputs = mapOutputsToProps && applyOutputs(signalGraph.output, mapOutputsToProps)
    const outputs = mapInputsToProps && mapInputsToProps(signalGraph.input, props)
    return { outputs, inputs }
  }
  return withViewModel(vmFactory)
}

const connectWithBoth = <PrimarySignalsType, DerivedSignalsType, S, A, P = {}>(
  signalGraph: SignalGraph<PrimarySignalsType, DerivedSignalsType>,
  mapOutputsToProps?: ((
    outputs: Output<PrimarySignalsType, DerivedSignalsType>,
    ownProps: Observable<P>
  ) => ObservableMap<S>),
  mapInputsToProps?: ((
    inputs: <K1 extends keyof PrimarySignalsType>(key: K1) => SubjectMap<PrimarySignalsType>[K1],
    ownProps: Observable<P>
  ) => SubjectMap<A>)
): ComponentEnhancer<S, A, P> => {
  const vmFactory: ViewModelFactory<S, A, P> = (props: Observable<P>) => {
    const inputs = mapOutputsToProps && mapOutputsToProps(signalGraph.output, props)
    const outputs = mapInputsToProps && mapInputsToProps(signalGraph.input, props)
    return { outputs, inputs }
  }
  return withViewModel(vmFactory)
}

export const connect: ConnectType = <
  PrimarySignalsType,
  DerivedSignalsType,
  S,
  A,
  KA extends KeyMap<PrimarySignalsType>,
  KS extends KeyMap<PrimarySignalsType & DerivedSignalsType>,
  P = {}
>(
  signalGraph: SignalGraph<PrimarySignalsType, DerivedSignalsType>,
  mapOutputsToProps?:
    | ((
        outputs: Output<PrimarySignalsType, DerivedSignalsType>,
        ownProps: Observable<P>
      ) => ObservableMap<S>)
    | KS,
  mapInputsToProps?:
    | ((
        inputs: <K1 extends keyof PrimarySignalsType>(
          key: K1
        ) => SubjectMap<PrimarySignalsType>[K1],
        ownProps: Observable<P>
      ) => SubjectMap<A>)
    | KA
) => {
  if (typeof mapInputsToProps === 'object') {
    if (typeof mapOutputsToProps === 'object') {
      return connectSimple(signalGraph, mapOutputsToProps, mapInputsToProps)
    } else {
      return connectWithOutputsFunc(signalGraph, mapOutputsToProps, mapInputsToProps)
    }
  } else {
    if (typeof mapOutputsToProps === 'object') {
      return connectWithInputsFunc(signalGraph, mapOutputsToProps, mapInputsToProps)
    } else {
      return connectWithBoth(signalGraph, mapOutputsToProps, mapInputsToProps)
    }
  }
}
