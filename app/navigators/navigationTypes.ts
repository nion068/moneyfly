import { ComponentProps } from "react"
import { BottomTabScreenProps } from "@react-navigation/bottom-tabs"
import {
  CompositeScreenProps,
  NavigationContainer,
  NavigatorScreenParams,
} from "@react-navigation/native"
import { NativeStackScreenProps } from "@react-navigation/native-stack"

import type { FlatTransaction } from "@/models/firefly"

export type MainTabParamList = {
  Home: undefined
  Accounts: undefined
  AiAssistant: undefined
  Analytics: undefined
  Settings: NavigatorScreenParams<SettingsStackParamList> | undefined
}

export type SettingsStackParamList = {
  SettingsHome: undefined
  SettingsFirefly: undefined
  SettingsAiAssistant: undefined
  SettingsAccounts: undefined
  SettingsClassification: undefined
  SettingsSecurity: undefined
}

export type DemoTabParamList = {
  DemoCommunity: undefined
  DemoShowroom: { queryIndex?: string; itemIndex?: string }
  DemoDebug: undefined
  DemoPodcastList: undefined
}

export type AppStackParamList = {
  Setup: undefined
  Main: NavigatorScreenParams<MainTabParamList>
  AddTransaction: undefined
  TransactionDetails: { transaction: FlatTransaction }
  EditTransaction: { groupId: string; journalId?: string }
  Login: undefined
  Welcome: undefined
  Demo: NavigatorScreenParams<DemoTabParamList>
}

export type AppStackScreenProps<T extends keyof AppStackParamList> = NativeStackScreenProps<
  AppStackParamList,
  T
>

export type MainTabScreenProps<T extends keyof MainTabParamList> = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, T>,
  AppStackScreenProps<keyof AppStackParamList>
>

export type SettingsStackScreenProps<T extends keyof SettingsStackParamList> =
  NativeStackScreenProps<SettingsStackParamList, T>

export type DemoTabScreenProps<T extends keyof DemoTabParamList> = CompositeScreenProps<
  BottomTabScreenProps<DemoTabParamList, T>,
  AppStackScreenProps<keyof AppStackParamList>
>

export interface NavigationProps extends Partial<
  ComponentProps<typeof NavigationContainer<AppStackParamList>>
> {}
