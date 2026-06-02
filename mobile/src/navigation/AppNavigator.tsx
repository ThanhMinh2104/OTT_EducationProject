import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createStackNavigator } from "@react-navigation/stack";
import LoginPassword from "../screens/LoginPassword";
import SignUpScreen from "../screens/SignUpScreen";
import SignUpInfoScreen from "../screens/SignUpInfoScreen";
import HomeScreen from "../screens/HomeScreen";
import ChatScreen from "../screens/ChatScreen";
import ChatScreenEnhanced from "../screens/ChatScreenEnhanced";
import ContactsScreen from "../screens/ContactsScreen";
import ForwardScreen from "../screens/ForwardScreen";
import VerifyOtpDK from "../screens/VerifyOtpDK";
import ForgotPasswordScreen from "../screens/ForgotPassword";
import VerifyOtpResetScreen from "../screens/VerifyOtpReset";
import ConfirmPasswordScreen from "../screens/ConfirmPassword";
import StrangerInboxScreen from "../screens/StrangerInboxScreen";
import QRScannerScreen from "../screens/QRScannerScreen";


export type RootStackParamList = {
  Login: undefined;
  SignUp: undefined;
  VerifyOtp: undefined;
  SignUpInfo: { sdt: string };
  ForgotPassword: undefined;
  VerifyOtpReset: undefined;
  ConfirmPassword: { sdt: string };
  Home: undefined;
  Chat: { selectedChat?: any } | undefined;
  ChatEnhanced: undefined;
  Contacts: { user: any; scannedUser?: any };
  Forward: { message: any; chatID: string };
  StrangerInbox: undefined;
  QRScanner: { currentUser: any };
};


const Stack = createStackNavigator<RootStackParamList>();

const AppNavigator = () => (
  <NavigationContainer>
    <Stack.Navigator
      initialRouteName="Login"
      screenOptions={{ headerShown: false }}
    >
      <Stack.Screen name="Login" component={LoginPassword} />
      <Stack.Screen name="SignUp" component={SignUpScreen} />
      <Stack.Screen name="SignUpInfo" component={SignUpInfoScreen} />
      <Stack.Screen name="Home" component={HomeScreen} />
      <Stack.Screen name="Chat" component={ChatScreen} />
      <Stack.Screen name="ChatEnhanced" component={ChatScreenEnhanced} />
      <Stack.Screen name="Contacts" component={ContactsScreen} />
      <Stack.Screen name="Forward" component={ForwardScreen} />
      <Stack.Screen name="StrangerInbox" component={StrangerInboxScreen} />
      <Stack.Screen name="QRScanner" component={QRScannerScreen} />
      <Stack.Screen name="VerifyOtp" component={VerifyOtpDK} />

      <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
      <Stack.Screen name="VerifyOtpReset" component={VerifyOtpResetScreen} />
      <Stack.Screen name="ConfirmPassword" component={ConfirmPasswordScreen} />
    </Stack.Navigator>
  </NavigationContainer>
);

export default AppNavigator;
