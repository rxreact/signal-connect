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

type ComponentEnhancer<S, A, P> = (<T extends S & ActionMap<A> & P>(
  WrappedComponent: React.ComponentType<T>
) => React.ComponentClass<Difference<T, S & ActionMap<A> & P>>)

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

type VMFactoryFn = {
  <S, A, P>(props: Observable<P>): ViewModel<S, A>
  <PrimarySignalsType, S, KA extends KeyMap<PrimarySignalsType>, P>(
    props: Observable<P>
  ): ViewModel<S, VMap<PrimarySignalsType, KA>>
  <
    PrimarySignalsType,
    DerivedSignalsType,
    KS extends KeyMap<PrimarySignalsType & DerivedSignalsType>,
    KA extends KeyMap<PrimarySignalsType>,
    P
  >(
    props: Observable<P>
  ): ViewModel<VMap<PrimarySignalsType & DerivedSignalsType, KS>, VMap<PrimarySignalsType, KA>>
  <
    PrimarySignalsType,
    DerivedSignalsType,
    KS extends KeyMap<PrimarySignalsType & DerivedSignalsType>,
    A,
    P
  >(
    props: Observable<P>
  ): ViewModel<VMap<PrimarySignalsType & DerivedSignalsType, KS>, A>
}
const connectFromFunction: ConnectType = <
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
):
  | ComponentEnhancer<S, A, P>
  | ComponentEnhancer<S, VMap<PrimarySignalsType, KA>, P>
  | ComponentEnhancer<
      VMap<PrimarySignalsType & DerivedSignalsType, KS>,
      VMap<PrimarySignalsType & DerivedSignalsType, KA>,
      P
    >
  | ComponentEnhancer<VMap<PrimarySignalsType & DerivedSignalsType, KS>, A, P> => {
  const vmFactory: VMFactoryFn = (props: Observable<P>) => {
    const inputs =
      typeof mapOutputsToProps === 'object'
        ? applyOutputs(signalGraph.output, mapOutputsToProps)
        : typeof mapOutputsToProps === 'function'
          ? mapOutputsToProps(signalGraph.output, props)
          : undefined
    const outputs =
      typeof mapInputsToProps === 'object'
        ? applyInputs(signalGraph.input, mapInputsToProps)
        : typeof mapInputsToProps === 'function'
          ? mapInputsToProps(signalGraph.input, props)
          : undefined
    return { outputs, inputs }
  }
  return withViewModel<
    S | VMap<PrimarySignalsType & DerivedSignalsType, KS>,
    A | VMap<PrimarySignalsType, KA>,
    P
  >(vmFactory)
}

export const connect = connectFromFunction
