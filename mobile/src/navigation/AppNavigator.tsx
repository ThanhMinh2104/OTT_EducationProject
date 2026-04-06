import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import LoginPassword from '../screens/LoginPassword';
import SignUpScreen from '../screens/SignUpScreen';
import SignUpInfoScreen from '../screens/SignUpInfoScreen';

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
    <Stack.Navigator initialRouteName="Login" screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login" component={LoginPassword} />
      <Stack.Screen name="SignUp" component={SignUpScreen} />
      <Stack.Screen name="SignUpInfo" component={SignUpInfoScreen} />
    </Stack.Navigator>
  </NavigationContainer>
);

export default AppNavigator;
