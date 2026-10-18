import './ui/native-shim';
import 'react-native-gesture-handler';
import React, { useEffect } from 'react';
import { Platform, View, useWindowDimensions, useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { StatusBar } from 'expo-status-bar';

import { ThemeProvider, useTheme, guardScreen } from './ui/theme';
import { PrefsProvider, usePrefs } from './store/PrefsContext';
import { onAuthChange } from './lib/wron-auth';
import { useStore } from './store/StoreContext';

import HomeScreen from './screens/HomeScreen';
import MagicTodoScreen from './screens/MagicTodoScreen';
import FormalizerScreen from './screens/FormalizerScreen';
import JudgeScreen from './screens/JudgeScreen';
import TaskmasterScreen from './screens/TaskmasterScreen';
import ProfessorScreen from './screens/ProfessorScreen';
import ConsultantScreen from './screens/ConsultantScreen';
import SettingsScreen from './screens/SettingsScreen';
import SignInScreen from './screens/SignInScreen';
import WelcomeScreen from './screens/WelcomeScreen';
import NowScreen from './screens/NowScreen';
import TasksScreen from './screens/TasksScreen';
import BreakItDownScreen from './screens/BreakItDownScreen';
import RoutinesScreen from './screens/RoutinesScreen';
import { StoreProvider } from './store/StoreContext';

const Stack = createStackNavigator();

const LIGHT = {
  bg: '#FFFFFF',
  surface: '#F4F2FC',
  surfaceAlt: '#E8E4F8',
  text: '#1E1B3A',
  textMuted: '#68648A',
  border: '#E0DCF2',
  accent: '#6C5CE7',
  accentSoft: '#E3DEFB',
  success: '#2F9E6B',
  warning: '#D98A22',
  danger: '#D6453D',
  accents: ['#6C5CE7', '#0FA3B1', '#F2994A', '#EB5E7C', '#2FA36B', '#3B82F6'],
};
const DARK = {
  bg: '#17162A',
  surface: '#211F3A',
  surfaceAlt: '#2B2949',
  text: '#F1F0FA',
  textMuted: '#A19FC4',
  border: '#38355C',
  accent: '#9B8CFF',
  accentSoft: '#3A3566',
  success: '#5FC79A',
  warning: '#F0B14E',
  danger: '#F0645C',
  accents: ['#9B8CFF', '#3FC8D6', '#F5A962', '#F2799A', '#5FC79A', '#6AA6FF'],
};

function Root() {
  const t = useTheme();
  const store = useStore() || {};
  // First launch goes through Welcome (which leads to the optional Sign in);
  // after onboarding the app opens on Home.
  const initial = store.ready && !store.onboardingDone ? 'Welcome' : 'Home';
  useEffect(() => {
    const off = onAuthChange(() => {});
    return () => { if (typeof off === 'function') off(); };
  }, []);
  return (
    <NavigationContainer
      theme={{
        ...DefaultTheme,
        dark: !!t.dark,
        colors: { ...DefaultTheme.colors, primary: t.accent, background: t.bg, card: t.surface, text: t.text, border: t.border, notification: t.accent },
      }}
    >
      <Stack.Navigator key={initial} initialRouteName={initial} screenOptions={{ headerShown: false, cardStyle: { flex: 1, backgroundColor: t.bg } }}>
        <Stack.Screen name="Home" component={guardScreen(HomeScreen, 'Home')} />
        <Stack.Screen name="Magic ToDo" component={guardScreen(MagicTodoScreen, 'Magic ToDo')} />
        <Stack.Screen name="Formalizer" component={guardScreen(FormalizerScreen, 'Formalizer')} />
        <Stack.Screen name="Judge" component={guardScreen(JudgeScreen, 'Judge')} />
        <Stack.Screen name="Taskmaster" component={guardScreen(TaskmasterScreen, 'Taskmaster')} />
        <Stack.Screen name="Professor" component={guardScreen(ProfessorScreen, 'Professor')} />
        <Stack.Screen name="Consultant" component={guardScreen(ConsultantScreen, 'Consultant')} />
        <Stack.Screen name="Settings" component={guardScreen(SettingsScreen, 'Settings')} />
        <Stack.Screen name="Sign in" component={guardScreen(SignInScreen, 'Sign in')} />
        <Stack.Screen name="Welcome" component={guardScreen(WelcomeScreen, 'Welcome')} />
        <Stack.Screen name="Now" component={guardScreen(NowScreen, 'Now')} />
        <Stack.Screen name="Tasks" component={guardScreen(TasksScreen, 'Tasks')} />
        <Stack.Screen name="Break it down" component={guardScreen(BreakItDownScreen, 'Break it down')} />
        <Stack.Screen name="Routines" component={guardScreen(RoutinesScreen, 'Routines')} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const PHONE_W = 390;
function WebPhone({ children }) {
  const { width, height } = useWindowDimensions();
  if (Platform.OS !== 'web' || width >= PHONE_W) return children;
  const k = width / PHONE_W;
  return (
    <View style={{ width: PHONE_W, height: height / k, transform: [{ scale: k }], transformOrigin: 'top left' }}>
      {children}
    </View>
  );
}

function Themed() {
  const { mode } = usePrefs();
  const system = useColorScheme();
  const dark = mode === 'dark' || (mode === 'auto' && system === 'dark');
  const p = dark ? DARK : LIGHT;
  return (
    <ThemeProvider theme={dark ? 'midnight' : 'cloud'} dark={dark} {...p}>
      <WebPhone>
        <Root />
      </WebPhone>
      <StatusBar style={dark ? 'light' : 'dark'} />
    </ThemeProvider>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <PrefsProvider>
          <StoreProvider>
            <Themed />
          </StoreProvider>
        </PrefsProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
