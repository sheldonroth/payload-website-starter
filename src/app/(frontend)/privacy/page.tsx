import type { Metadata } from 'next'
import React from 'react'

export const metadata: Metadata = {
  title: 'Privacy Policy | The Product Report',
  description: 'How we collect, use, and protect your personal information.',
}

export default function PrivacyPolicyPage() {
  const lastUpdated = 'January 3, 2026'

  return (
    <main className="container py-16 max-w-4xl mx-auto px-4">
      <h1 className="text-4xl font-bold mb-4">Privacy Policy</h1>
      <p className="text-gray-600 dark:text-gray-400 mb-8">Last updated: {lastUpdated}</p>

      <div className="prose dark:prose-invert max-w-none space-y-8">
        {/* Introduction */}
        <section>
          <h2 className="text-2xl font-semibold mb-4">Introduction</h2>
          <p>
            The Product Report (&quot;we,&quot; &quot;our,&quot; or &quot;us&quot;) respects your privacy and is committed
            to protecting your personal data. This privacy policy explains how we collect, use, disclose,
            and safeguard your information when you use our website and services.
          </p>
        </section>

        {/* Information We Collect */}
        <section>
          <h2 className="text-2xl font-semibold mb-4">Information We Collect</h2>

          <h3 className="text-xl font-medium mt-4 mb-2">Information You Provide</h3>
          <ul className="list-disc pl-6 space-y-2">
            <li><strong>Account Information:</strong> Name, email address when you create an account</li>
            <li><strong>Profile Preferences:</strong> Saved products, watchlist categories, ingredient preferences</li>
            <li><strong>Communications:</strong> Information you provide when contacting support</li>
          </ul>

          <h3 className="text-xl font-medium mt-4 mb-2">Information Collected Automatically</h3>
          <ul className="list-disc pl-6 space-y-2">
            <li><strong>Device Information:</strong> Browser type, operating system, device type</li>
            <li><strong>Usage Data:</strong> Pages visited, products viewed, features used</li>
            <li><strong>Device Identifiers:</strong> Anonymous fingerprints for fraud prevention (not for tracking)</li>
          </ul>

          <h3 className="text-xl font-medium mt-4 mb-2">Information from Third Parties</h3>
          <ul className="list-disc pl-6 space-y-2">
            <li><strong>OAuth Providers:</strong> When you sign in with Google or Apple, we receive your name and email</li>
            <li><strong>Payment Processors:</strong> Stripe provides transaction confirmations (we do not store card numbers)</li>
          </ul>
        </section>

        {/* How We Use Your Information */}
        <section>
          <h2 className="text-2xl font-semibold mb-4">How We Use Your Information</h2>
          <ul className="list-disc pl-6 space-y-2">
            <li>Provide, maintain, and improve our services</li>
            <li>Process transactions and send related information</li>
            <li>Send product recommendations based on your watchlist</li>
            <li>Send weekly digest emails (if you opted in)</li>
            <li>Prevent fraud and enforce our terms of service</li>
            <li>Respond to your requests and provide customer support</li>
            <li>Aggregate analytics to improve our product reviews</li>
          </ul>
        </section>

        {/* Data Retention */}
        <section>
          <h2 className="text-2xl font-semibold mb-4">Data Retention</h2>
          <p className="mb-4">We retain your data for specific periods based on the type of information:</p>
          <table className="w-full border-collapse border border-gray-300 dark:border-gray-700">
            <thead>
              <tr className="bg-gray-100 dark:bg-gray-800">
                <th className="border border-gray-300 dark:border-gray-700 px-4 py-2 text-left">Data Type</th>
                <th className="border border-gray-300 dark:border-gray-700 px-4 py-2 text-left">Retention Period</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-gray-300 dark:border-gray-700 px-4 py-2">Account Information</td>
                <td className="border border-gray-300 dark:border-gray-700 px-4 py-2">Until you delete your account</td>
              </tr>
              <tr>
                <td className="border border-gray-300 dark:border-gray-700 px-4 py-2">Device Fingerprints</td>
                <td className="border border-gray-300 dark:border-gray-700 px-4 py-2">Deleted upon account deletion</td>
              </tr>
              <tr>
                <td className="border border-gray-300 dark:border-gray-700 px-4 py-2">Product Unlock History</td>
                <td className="border border-gray-300 dark:border-gray-700 px-4 py-2">Anonymized upon account deletion</td>
              </tr>
              <tr>
                <td className="border border-gray-300 dark:border-gray-700 px-4 py-2">Audit Logs</td>
                <td className="border border-gray-300 dark:border-gray-700 px-4 py-2">2 years (legal compliance)</td>
              </tr>
              <tr>
                <td className="border border-gray-300 dark:border-gray-700 px-4 py-2">Cookie Consent Records</td>
                <td className="border border-gray-300 dark:border-gray-700 px-4 py-2">2 years from consent date</td>
              </tr>
            </tbody>
          </table>
        </section>

        {/* Your Rights */}
        <section>
          <h2 className="text-2xl font-semibold mb-4">Your Privacy Rights</h2>
          <p className="mb-4">
            Depending on your location, you may have the following rights under GDPR, CCPA, and other privacy laws:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              <strong>Right to Access:</strong> Request a copy of your personal data.{' '}
              <a href="/account/export-data" className="text-emerald-600 dark:text-emerald-400 underline">
                Download your data
              </a>
            </li>
            <li>
              <strong>Right to Rectification:</strong> Request correction of inaccurate data via your account settings
            </li>
            <li>
              <strong>Right to Erasure:</strong> Request deletion of your account and personal data.{' '}
              <a href="/account/delete" className="text-emerald-600 dark:text-emerald-400 underline">
                Delete your account
              </a>
            </li>
            <li>
              <strong>Right to Data Portability:</strong> Receive your data in a machine-readable format (JSON)
            </li>
            <li>
              <strong>Right to Object:</strong> Opt out of marketing emails and personalized recommendations
            </li>
            <li>
              <strong>Right to Withdraw Consent:</strong> Change your privacy preferences at any time
            </li>
          </ul>
        </section>

        {/* California Residents */}
        <section>
          <h2 className="text-2xl font-semibold mb-4">California Residents (CCPA)</h2>
          <p className="mb-4">
            Under the California Consumer Privacy Act (CCPA) and California Privacy Rights Act (CPRA),
            California residents have additional rights:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              <strong>Do Not Sell or Share:</strong> We do not sell your personal information.
              You can opt out of sharing for targeted advertising via our cookie consent banner.
            </li>
            <li>
              <strong>Right to Know:</strong> Request disclosure of what personal information we collect
            </li>
            <li>
              <strong>Right to Delete:</strong> Request deletion of your personal information
            </li>
            <li>
              <strong>Right to Correct:</strong> Request correction of inaccurate personal information
            </li>
            <li>
              <strong>Non-Discrimination:</strong> We will not discriminate against you for exercising your rights
            </li>
          </ul>
          <p className="mt-4">
            To exercise these rights, email us at{' '}
            <a href="mailto:privacy@theproductreport.org" className="text-emerald-600 dark:text-emerald-400 underline">
              privacy@theproductreport.org
            </a>{' '}
            or use the self-service options in your account settings.
          </p>
        </section>

        {/* Global Privacy Control */}
        <section>
          <h2 className="text-2xl font-semibold mb-4">Global Privacy Control (GPC)</h2>
          <p>
            We honor Global Privacy Control (GPC) signals. When we detect a GPC signal from your browser,
            we automatically:
          </p>
          <ul className="list-disc pl-6 space-y-2 mt-2">
            <li>Do not set non-essential cookies</li>
            <li>Do not share data with third-party advertisers</li>
            <li>Treat this as an opt-out of data sale/sharing</li>
          </ul>
          <p className="mt-2">
            Learn more about GPC at{' '}
            <a
              href="https://globalprivacycontrol.org/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-emerald-600 dark:text-emerald-400 underline"
            >
              globalprivacycontrol.org
            </a>
          </p>
        </section>

        {/* Cookies */}
        <section>
          <h2 className="text-2xl font-semibold mb-4">Cookies and Tracking</h2>
          <p className="mb-4">We use cookies and similar technologies:</p>
          <table className="w-full border-collapse border border-gray-300 dark:border-gray-700">
            <thead>
              <tr className="bg-gray-100 dark:bg-gray-800">
                <th className="border border-gray-300 dark:border-gray-700 px-4 py-2 text-left">Type</th>
                <th className="border border-gray-300 dark:border-gray-700 px-4 py-2 text-left">Purpose</th>
                <th className="border border-gray-300 dark:border-gray-700 px-4 py-2 text-left">Required</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-gray-300 dark:border-gray-700 px-4 py-2">Essential</td>
                <td className="border border-gray-300 dark:border-gray-700 px-4 py-2">Login sessions, security</td>
                <td className="border border-gray-300 dark:border-gray-700 px-4 py-2">Yes</td>
              </tr>
              <tr>
                <td className="border border-gray-300 dark:border-gray-700 px-4 py-2">Analytics</td>
                <td className="border border-gray-300 dark:border-gray-700 px-4 py-2">Usage statistics (aggregated)</td>
                <td className="border border-gray-300 dark:border-gray-700 px-4 py-2">No - with consent</td>
              </tr>
              <tr>
                <td className="border border-gray-300 dark:border-gray-700 px-4 py-2">Preferences</td>
                <td className="border border-gray-300 dark:border-gray-700 px-4 py-2">Theme, consent choices</td>
                <td className="border border-gray-300 dark:border-gray-700 px-4 py-2">No - localStorage</td>
              </tr>
            </tbody>
          </table>
          <p className="mt-4">
            You can manage cookie preferences through our cookie consent banner or your browser settings.
          </p>
        </section>

        {/* Security */}
        <section>
          <h2 className="text-2xl font-semibold mb-4">Data Security</h2>
          <p>We implement industry-standard security measures:</p>
          <ul className="list-disc pl-6 space-y-2 mt-2">
            <li>All data transmitted over HTTPS (TLS 1.3)</li>
            <li>Passwords hashed using bcrypt</li>
            <li>Database encryption at rest</li>
            <li>Regular security audits</li>
            <li>Access controls and audit logging</li>
          </ul>
        </section>

        {/* Children */}
        <section>
          <h2 className="text-2xl font-semibold mb-4">Children&apos;s Privacy</h2>
          <p>
            Our services are not directed to children under 13. We do not knowingly collect personal
            information from children under 13. If you believe we have collected information from a
            child under 13, please contact us immediately.
          </p>
        </section>

        {/* Changes */}
        <section>
          <h2 className="text-2xl font-semibold mb-4">Changes to This Policy</h2>
          <p>
            We may update this privacy policy from time to time. We will notify you of any changes
            by posting the new policy on this page and updating the &quot;Last updated&quot; date.
            For significant changes, we will send an email notification to registered users.
          </p>
        </section>

        {/* Contact */}
        <section>
          <h2 className="text-2xl font-semibold mb-4">Contact Us</h2>
          <p>For privacy-related questions or to exercise your rights:</p>
          <ul className="list-none mt-2 space-y-1">
            <li>
              <strong>Email:</strong>{' '}
              <a href="mailto:privacy@theproductreport.org" className="text-emerald-600 dark:text-emerald-400 underline">
                privacy@theproductreport.org
              </a>
            </li>
            <li><strong>Address:</strong> The Product Report, Privacy Team</li>
          </ul>
          <p className="mt-4">
            We aim to respond to all privacy requests within 30 days.
          </p>
        </section>
      </div>
    </main>
  )
}
