import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createStackNavigator } from "@react-navigation/stack";
import SignUpScreen from "../screens/SignUpScreen";
import SignUpInfoScreen from "../screens/SignUpInfoScreen";
import VerifyOtpDK from "../screens/VerifyOtpDK";
import ForgotPasswordScreen from "../screens/ForgotPassword";
import VerifyOtpResetScreen from "../screens/VerifyOtpReset";

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
      initialRouteName="ForgotPassword"
      screenOptions={{ headerShown: false }}
    >
      <Stack.Screen name="SignUp" component={SignUpScreen} />
      <Stack.Screen name="SignUpInfo" component={SignUpInfoScreen} />
      <Stack.Screen name="VerifyOtp" component={VerifyOtpDK} />
      <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
      <Stack.Screen name="VerifyOtpReset" component={VerifyOtpResetScreen} />


    </Stack.Navigator>
  </NavigationContainer>
);

export default AppNavigator;
