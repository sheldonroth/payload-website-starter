/**
 * React Email Components
 *
 * Reusable components for building beautiful emails.
 * All components are cross-client compatible (Gmail, Outlook, Apple Mail, Yahoo).
 */

// Layout
export { EmailLayout } from './EmailLayout'

// Typography
export { EmailH1, EmailH2, EmailH3, EmailText } from './EmailHeading'

// Interactive
export { EmailButton } from './EmailButton'

// Content
export { EmailProductCard } from './EmailProductCard'
export { EmailStats } from './EmailStats'
export { EmailCallout } from './EmailCallout'

// Utilities
export { EmailDivider } from './EmailDivider'

// Re-export useful React Email primitives
export {
  Body,
  Column,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Row,
  Section,
  Text,
} from '@react-email/components'
