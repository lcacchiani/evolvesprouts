import {
  AuthenticationDetails,
  CognitoUser,
  CognitoUserAttribute,
  CognitoUserPool,
  CognitoUserSession,
} from 'amazon-cognito-identity-js';

import { appConfig } from './config';

export interface PasswordlessTokens {
  accessToken: string;
  idToken: string;
  refreshToken?: string;
  expiresAt: number;
}

function getUserPool() {
  const userPoolId = appConfig.cognitoUserPoolId.trim();
  const clientId = appConfig.cognitoClientId.trim();

  if (!userPoolId || !clientId) {
    throw new Error('Cognito User Pool ID or Client ID is not configured.');
  }

  return new CognitoUserPool({
    UserPoolId: userPoolId,
    ClientId: clientId,
  });
}

function sessionToTokens(session: CognitoUserSession): PasswordlessTokens {
  const accessToken = session.getAccessToken();
  const idToken = session.getIdToken();
  const refreshToken = session.getRefreshToken();

  return {
    accessToken: accessToken.getJwtToken(),
    idToken: idToken.getJwtToken(),
    refreshToken: refreshToken?.getToken(),
    expiresAt: accessToken.getExpiration() * 1000,
  };
}

export function initiatePasswordlessSignIn(email: string): Promise<CognitoUser> {
  return new Promise((resolve, reject) => {
    const userPool = getUserPool();

    const cognitoUser = new CognitoUser({
      Username: email.toLowerCase().trim(),
      Pool: userPool,
    });

    const authDetails = new AuthenticationDetails({
      Username: email.toLowerCase().trim(),
    });

    cognitoUser.setAuthenticationFlowType('CUSTOM_AUTH');

    cognitoUser.initiateAuth(authDetails, {
      onSuccess: () => {
        reject(new Error('Unexpected authentication success without challenge.'));
      },
      onFailure: (error) => {
        reject(error);
      },
      customChallenge: () => {
        resolve(cognitoUser);
      },
    });
  });
}

export function respondToPasswordlessChallenge(
  cognitoUser: CognitoUser,
  code: string,
): Promise<PasswordlessTokens> {
  return new Promise((resolve, reject) => {
    cognitoUser.sendCustomChallengeAnswer(code.trim(), {
      onSuccess: (session) => {
        resolve(sessionToTokens(session));
      },
      onFailure: (error) => {
        reject(error);
      },
      customChallenge: () => {
        reject(new Error('Invalid code. Please try again.'));
      },
    });
  });
}

export function signUpPasswordlessUser(email: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const userPool = getUserPool();
    const normalizedEmail = email.toLowerCase().trim();
    const randomPassword = generateSecurePassword();

    const emailAttribute = new CognitoUserAttribute({
      Name: 'email',
      Value: normalizedEmail,
    });

    userPool.signUp(
      normalizedEmail,
      randomPassword,
      [emailAttribute],
      [],
      (error) => {
        if (error) {
          if (error.name === 'UsernameExistsException') {
            resolve();
            return;
          }
          reject(error);
          return;
        }
        resolve();
      },
    );
  });
}

function generateSecurePassword() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => chars[byte % chars.length]).join('');
}
