import { render } from '@react-email/components'
import * as React from 'react'
import { WelcomeEmail } from './templates/WelcomeEmail'
import { OneShotReceipt } from './templates/OneShotReceipt'
import { PasswordReset } from './templates/PasswordReset'

/**
 * Render React Email templates to HTML strings
 * These functions are used in Payload hooks and endpoints
 */

export async function renderWelcomeEmail(name: string): Promise<string> {
  return render(React.createElement(WelcomeEmail, { name }))
}

export async function renderOneShotReceipt(params: {
  userName: string
  productName: string
  productSlug: string
}): Promise<string> {
  return render(React.createElement(OneShotReceipt, params))
}

export async function renderPasswordReset(resetUrl: string): Promise<string> {
  return render(React.createElement(PasswordReset, { resetUrl }))
}

// Email subjects
export const emailSubjects = {
  welcome: 'You just took back control',
  oneShotReceipt: (productName: string) => `Your free report: ${productName}`,
  passwordReset: 'Reset Your Password - The Product Report',
}
