import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import SignUpScreen from '../screens/SignUpScreen';
import SignUpInfoScreen from '../screens/SignUpInfoScreen';
import HomeScreen from '../screens/HomeScreen';
import VerifyOtpDK from "../screens/VerifyOtpDK";

export type RootStackParamList = {
  Login: undefined;
  SignUp: undefined;
  VerifyOtp: undefined;
  SignUpInfo: { email: string; sdt: string };
  ForgotPassword: undefined;
  VerifyOtpReset: undefined;
  ConfirmPassword: { sdt: string };
  Home: undefined;
};

const Stack = createStackNavigator<RootStackParamList>();

const AppNavigator = () => (
  <NavigationContainer>
    <Stack.Navigator
      initialRouteName="SignUp"
      screenOptions={{ headerShown: false }}
    >
      <Stack.Screen name="SignUp" component={SignUpScreen} />
      <Stack.Screen name="SignUpInfo" component={SignUpInfoScreen} />
      <Stack.Screen name="Home" component={HomeScreen} />
      <Stack.Screen name="VerifyOtp" component={VerifyOtpDK} />
    </Stack.Navigator>
  </NavigationContainer>
);

export default AppNavigator;
