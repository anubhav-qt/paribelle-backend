/**
 * Seed Custom Pages Script
 * Seeds the database with custom page templates for the marketplace
 */

require('dotenv').config();
const { Pool } = require('pg');

// Custom page templates
const pageTemplates = [
  {
    title: 'Privacy Policy',
    slug: 'privacy-policy',
    content: `# Privacy Policy

**Last Updated: December 27, 2025**

## Introduction

Welcome to our marketplace. We are committed to protecting your privacy and ensuring the security of your personal information. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you visit our website and use our services.

## Information We Collect

### Personal Information
We may collect personal information that you voluntarily provide to us when you:
- Register for an account
- Make a purchase
- Subscribe to our newsletter
- Contact customer support
- Participate in surveys or promotions

This information may include:
- Name and contact information (email address, phone number, mailing address)
- Payment information (credit card details, billing address)
- Account credentials (username, password)
- Profile information (preferences, purchase history)

### Automatically Collected Information
When you visit our website, we automatically collect certain information about your device, including:
- IP address
- Browser type and version
- Operating system
- Referring URLs
- Pages viewed and time spent on pages
- Click-stream data
- Cookies and similar tracking technologies

## How We Use Your Information

We use the collected information for various purposes:

- **Order Processing**: To process and fulfill your orders, manage payments, and provide customer support
- **Account Management**: To create and maintain your account, send account-related notifications
- **Communication**: To send promotional emails, newsletters, and important updates (you can opt-out anytime)
- **Personalization**: To customize your shopping experience and recommend relevant products
- **Analytics**: To analyze usage patterns, improve our services, and optimize user experience
- **Security**: To protect against fraud, unauthorized access, and other security threats
- **Legal Compliance**: To comply with applicable laws, regulations, and legal processes

## Information Sharing and Disclosure

We do not sell or rent your personal information to third parties. However, we may share your information in the following circumstances:

### Service Providers
We may share information with trusted third-party service providers who assist us in:
- Payment processing
- Order fulfillment and shipping
- Email marketing and communications
- Analytics and data analysis
- Customer support services

### Vendors
When you make a purchase from a vendor on our marketplace, we share necessary information with that vendor to fulfill your order.

### Legal Requirements
We may disclose your information if required by law, court order, or governmental regulation, or if we believe disclosure is necessary to:
- Comply with legal obligations
- Protect our rights and property
- Prevent fraud or security threats
- Protect the safety of users or the public

### Business Transfers
In the event of a merger, acquisition, or sale of assets, your information may be transferred to the acquiring entity.

## Data Security

We implement appropriate technical and organizational measures to protect your personal information against unauthorized access, alteration, disclosure, or destruction. These measures include:
- Encryption of sensitive data (SSL/TLS)
- Secure servers and databases
- Regular security assessments
- Access controls and authentication
- Employee training on data protection

However, no method of transmission over the internet or electronic storage is 100% secure, and we cannot guarantee absolute security.

## Your Rights and Choices

Depending on your location, you may have the following rights:

### Access and Portability
You can request access to your personal information and receive a copy in a portable format.

### Correction
You can update or correct inaccurate personal information through your account settings or by contacting us.

### Deletion
You can request deletion of your personal information, subject to legal requirements and legitimate business needs.

### Opt-Out
You can opt-out of marketing communications by:
- Clicking the "unsubscribe" link in emails
- Updating your communication preferences in account settings
- Contacting us directly

### Cookies
You can control cookies through your browser settings, but some features may not function properly if cookies are disabled.

## Cookies and Tracking Technologies

We use cookies and similar technologies to:
- Remember your preferences and settings
- Authenticate your account
- Analyze site traffic and usage
- Personalize content and advertisements
- Improve site performance

For more details, please see our [Cookie Policy](/cookie-policy).

## Third-Party Links

Our website may contain links to third-party websites. We are not responsible for the privacy practices or content of these external sites. We encourage you to review their privacy policies before providing any personal information.

## Children's Privacy

Our services are not intended for children under 13 years of age. We do not knowingly collect personal information from children. If you believe we have inadvertently collected information from a child, please contact us immediately.

## International Data Transfers

Your information may be transferred to and processed in countries other than your country of residence. We ensure appropriate safeguards are in place to protect your information in accordance with this Privacy Policy.

## Changes to This Privacy Policy

We may update this Privacy Policy from time to time to reflect changes in our practices or legal requirements. We will notify you of significant changes by:
- Posting the updated policy on our website
- Updating the "Last Updated" date
- Sending email notifications for material changes

## Contact Us

If you have questions, concerns, or requests regarding this Privacy Policy or our data practices, please contact us:

**Email**: privacy@yourmarketplace.com  
**Phone**: +1 (555) 123-4567  
**Address**: 123 Marketplace Street, City, State 12345

---

*By using our services, you acknowledge that you have read and understood this Privacy Policy.*`,
    status: 'published',
    showInNavigation: true
  },
  {
    title: 'Terms of Service',
    slug: 'terms-of-service',
    content: `# Terms of Service

**Last Updated: December 27, 2025**

## Agreement to Terms

By accessing and using this marketplace website ("Service"), you accept and agree to be bound by the terms and provisions of this agreement. If you do not agree to these Terms of Service, please do not use our Service.

## Definitions

- **"Marketplace," "we," "us," or "our"** refers to our platform and company
- **"User," "you," or "your"** refers to individuals or entities using our Service
- **"Vendor"** refers to sellers offering products or services on our platform
- **"Customer"** refers to users who purchase products or services
- **"Content"** refers to text, images, videos, and other materials on the Service

## Use of Service

### Eligibility
You must be at least 18 years old to use our Service. By using the Service, you represent and warrant that you meet this requirement.

### Account Registration
To access certain features, you must register for an account. You agree to:
- Provide accurate, current, and complete information
- Maintain the security of your password and account
- Notify us immediately of any unauthorized use
- Accept responsibility for all activities under your account

### Prohibited Activities
You agree not to:
- Violate any laws or regulations
- Infringe on intellectual property rights
- Transmit viruses, malware, or harmful code
- Engage in fraudulent activities or payment disputes
- Harass, abuse, or harm other users
- Scrape, crawl, or harvest data from the Service
- Attempt to gain unauthorized access to systems
- Use the Service for commercial purposes without authorization
- Post false, misleading, or deceptive content
- Manipulate prices, ratings, or reviews

## Vendor Terms

### Vendor Registration
Vendors must apply and be approved before selling on our platform. We reserve the right to reject or terminate vendor accounts at our discretion.

### Product Listings
Vendors are responsible for:
- Accurate product descriptions and pricing
- Complying with all applicable laws and regulations
- Fulfilling orders in a timely manner
- Providing customer support for their products
- Maintaining adequate inventory

### Prohibited Products
Vendors may not sell:
- Illegal items or services
- Counterfeit or stolen goods
- Hazardous materials (unless properly licensed)
- Products infringing intellectual property rights
- Adult content (unless in designated areas with age verification)
- Weapons or ammunition (subject to local regulations)

### Fees and Payments
Vendors agree to pay:
- Commission fees as specified in the vendor agreement
- Transaction processing fees
- Any additional service fees

Payments to vendors are processed according to the payment schedule outlined in the vendor dashboard.

## Customer Terms

### Orders and Purchases
When placing an order, you agree to:
- Provide accurate shipping and billing information
- Pay all charges at the prices in effect when orders are placed
- Authorize payment through your selected method

### Order Confirmation
Order confirmation does not guarantee product availability. We or vendors reserve the right to cancel orders due to:
- Product unavailability
- Pricing errors
- Suspected fraud
- Violation of terms

### Shipping and Delivery
- Shipping times are estimates and not guaranteed
- Risk of loss transfers upon delivery to the carrier
- You are responsible for monitoring shipment tracking
- Address delivery issues with the respective vendor

## Payments

### Payment Methods
We accept various payment methods including credit cards, debit cards, and other payment services. You agree to:
- Provide valid payment information
- Pay all charges and applicable taxes
- Resolve any payment disputes with your financial institution

### Pricing
- All prices are subject to change without notice
- Prices include applicable taxes unless otherwise stated
- Currency conversion fees may apply for international transactions

### Refunds
Refund policies are set by individual vendors. Please review vendor-specific policies before purchasing. General guidelines:
- Refunds are issued to the original payment method
- Processing time varies by payment method
- Partial refunds may apply for partial returns

## Intellectual Property

### Our Content
All content on the Service, including text, graphics, logos, images, and software, is our property or our licensors' and is protected by copyright, trademark, and other intellectual property laws.

### User Content
When you post content on the Service, you:
- Retain ownership of your content
- Grant us a worldwide, non-exclusive, royalty-free license to use, reproduce, modify, and display your content
- Represent that you have the right to post the content
- Agree that your content does not violate any laws or rights

### Vendor Content
Vendors retain ownership of their product listings and content but grant us similar licenses to display and promote their products on the platform.

## Reviews and Ratings

### Authentic Reviews
Reviews must be:
- Based on genuine experiences
- Honest and not misleading
- Free from conflicts of interest
- Compliant with our review guidelines

We reserve the right to remove reviews that violate these standards.

### Review Moderation
We may moderate, edit, or remove reviews that:
- Contain offensive or inappropriate language
- Include personal information
- Are suspected of being fake or manipulated
- Violate intellectual property rights

## Disclaimers

### "As Is" Basis
The Service is provided "as is" and "as available" without warranties of any kind, either express or implied, including but not limited to:
- Merchantability
- Fitness for a particular purpose
- Non-infringement
- Accuracy or completeness of content

### Vendor Products
We are not responsible for:
- Quality, safety, or legality of vendor products
- Accuracy of product descriptions
- Vendor's ability to fulfill orders
- Defects in products or services

You purchase from vendors at your own risk.

### Third-Party Links
We are not responsible for content or practices of third-party websites linked from our Service.

## Limitation of Liability

To the maximum extent permitted by law:

- We are not liable for indirect, incidental, special, consequential, or punitive damages
- Our total liability shall not exceed the amount you paid to us in the past 12 months
- Some jurisdictions do not allow limitation of liability, so these limitations may not apply to you

## Indemnification

You agree to indemnify, defend, and hold harmless our company, officers, directors, employees, and agents from any claims, damages, losses, liabilities, and expenses (including legal fees) arising from:
- Your use of the Service
- Your violation of these Terms
- Your violation of any rights of another party
- Your content or product listings

## Dispute Resolution

### Governing Law
These Terms are governed by the laws of [Your Jurisdiction], without regard to conflict of law principles.

### Arbitration
Any disputes arising from these Terms or the Service shall be resolved through binding arbitration, except:
- Small claims court actions
- Intellectual property disputes
- Emergency equitable relief

### Class Action Waiver
You agree to resolve disputes on an individual basis and waive the right to participate in class actions.

## Termination

### By You
You may terminate your account at any time by contacting us or using account settings.

### By Us
We may suspend or terminate your account if you:
- Violate these Terms
- Engage in fraudulent activity
- Harm other users or the platform
- For any reason at our discretion with or without notice

### Effect of Termination
Upon termination:
- Your access to the Service will be revoked
- Outstanding obligations remain in effect
- Provisions that should survive termination will continue

## General Provisions

### Entire Agreement
These Terms constitute the entire agreement between you and us regarding the Service.

### Amendments
We reserve the right to modify these Terms at any time. Changes will be effective upon posting. Continued use of the Service constitutes acceptance of modified Terms.

### Severability
If any provision is found unenforceable, the remaining provisions will remain in effect.

### Waiver
Our failure to enforce any right or provision does not constitute a waiver of that right.

### Assignment
You may not assign your rights under these Terms. We may assign our rights without restriction.

### Force Majeure
We are not liable for delays or failures due to circumstances beyond our reasonable control.

### Contact for Legal Notices
Legal notices should be sent to:

**Email**: legal@yourmarketplace.com  
**Address**: 123 Marketplace Street, City, State 12345

## Contact Us

For questions about these Terms of Service:

**Email**: support@yourmarketplace.com  
**Phone**: +1 (555) 123-4567  
**Live Chat**: Available on our website during business hours

---

*By using our Service, you acknowledge that you have read, understood, and agree to be bound by these Terms of Service.*`,
    status: 'published',
    showInNavigation: true
  },
  {
    title: 'Cookie Policy',
    slug: 'cookie-policy',
    content: `# Cookie Policy

**Last Updated: December 27, 2025**

## What Are Cookies?

Cookies are small text files that are placed on your device (computer, smartphone, or tablet) when you visit a website. They are widely used to make websites work more efficiently and provide information to website owners.

## How We Use Cookies

We use cookies and similar tracking technologies to enhance your experience, analyze site usage, and assist in our marketing efforts. This Cookie Policy explains what cookies are, how we use them, and your choices regarding their use.

## Types of Cookies We Use

### Essential Cookies
**Purpose**: These cookies are necessary for the website to function properly.

**Examples**:
- Session management
- Authentication and security
- Shopping cart functionality
- Load balancing

**Duration**: Session or short-term

**Can be disabled**: No, these are required for basic functionality

### Performance Cookies
**Purpose**: These cookies help us understand how visitors interact with our website.

**Examples**:
- Google Analytics
- Page load times
- Error tracking
- User flow analysis

**Information collected**:
- Pages visited
- Time spent on pages
- Navigation paths
- Device and browser information

**Duration**: Up to 2 years

**Can be disabled**: Yes

### Functionality Cookies
**Purpose**: These cookies allow the website to remember your preferences.

**Examples**:
- Language preferences
- Currency selection
- Font size and accessibility settings
- Recently viewed products

**Duration**: Up to 1 year

**Can be disabled**: Yes, but functionality may be limited

### Targeting/Advertising Cookies
**Purpose**: These cookies are used to deliver relevant advertisements and track ad campaign effectiveness.

**Examples**:
- Facebook Pixel
- Google Ads
- Remarketing tags
- Affiliate tracking

**Information collected**:
- Browsing history
- Product interests
- Click behavior
- Ad interactions

**Duration**: Up to 2 years

**Can be disabled**: Yes

### Social Media Cookies
**Purpose**: These cookies enable social media features and track social network activity.

**Examples**:
- Facebook social plugins
- Twitter share buttons
- Instagram feeds
- LinkedIn integration

**Duration**: Varies by platform

**Can be disabled**: Yes

## Specific Cookies We Use

| Cookie Name | Type | Purpose | Duration |
|------------|------|---------|----------|
| \`session_id\` | Essential | User authentication | Session |
| \`cart_token\` | Essential | Shopping cart management | 30 days |
| \`_ga\` | Performance | Google Analytics tracking | 2 years |
| \`_gid\` | Performance | Google Analytics tracking | 24 hours |
| \`preferred_language\` | Functionality | Language preference | 1 year |
| \`currency\` | Functionality | Currency selection | 1 year |
| \`_fbp\` | Advertising | Facebook Pixel | 90 days |
| \`_gcl_au\` | Advertising | Google Ads conversion | 90 days |

*Note: This is not an exhaustive list. Additional cookies may be set by third-party services.*

## Third-Party Cookies

We use various third-party services that may set their own cookies:

### Analytics Services
- **Google Analytics**: Tracks website usage and generates reports
- **Hotjar**: Records user behavior and heatmaps
- **Microsoft Clarity**: Analyzes user interactions

### Advertising Networks
- **Google Ads**: Delivers targeted advertisements
- **Facebook Ads**: Shows relevant ads across Facebook platforms
- **Affiliate Networks**: Tracks referrals and commissions

### Payment Processors
- **Stripe**: Processes credit card payments securely
- **PayPal**: Handles PayPal transactions
- **Razorpay**: Manages payment gateway

### Customer Support
- **Intercom**: Live chat support
- **Zendesk**: Customer service ticketing

### Email Services
- **Mailchimp**: Email marketing campaigns
- **SendGrid**: Transactional emails

Each third-party service has its own privacy and cookie policies. We encourage you to review them.

## How to Control Cookies

You have several options to manage or disable cookies:

### Browser Settings
Most browsers allow you to:
- View and delete cookies
- Block all cookies
- Block third-party cookies
- Clear cookies when closing the browser

**Instructions for popular browsers**:

**Google Chrome**:
1. Settings → Privacy and security → Cookies and other site data
2. Choose your preferred cookie settings

**Firefox**:
1. Options → Privacy & Security
2. Select cookie preferences under "Cookies and Site Data"

**Safari**:
1. Preferences → Privacy
2. Manage cookies under "Cookies and website data"

**Microsoft Edge**:
1. Settings → Privacy, search, and services
2. Configure cookies under "Cookies and site data"

### Cookie Consent Manager
When you first visit our website, you'll see a cookie consent banner. You can:
- Accept all cookies
- Reject non-essential cookies
- Customize your cookie preferences
- Change your preferences anytime in the footer

### Opt-Out Tools
You can opt out of certain tracking:

**Google Analytics**: [Google Analytics Opt-out Browser Add-on](https://tools.google.com/dlpage/gaoptout)

**Facebook Pixel**: [Facebook Ad Settings](https://www.facebook.com/settings?tab=ads)

**Network Advertising Initiative**: [NAI Opt-Out Tool](http://www.networkadvertising.org/choices/)

**Digital Advertising Alliance**: [DAA Opt-Out Tool](http://www.aboutads.info/choices/)

### Do Not Track
Some browsers offer "Do Not Track" (DNT) settings. We respect DNT signals and will not track users who have enabled this feature.

## Consequences of Disabling Cookies

If you disable or refuse cookies:

**Will still work**:
- Basic browsing
- Viewing product listings
- Reading content

**May not work properly**:
- Shopping cart
- Account login
- Checkout process
- Personalized recommendations
- Remember preferences
- Some interactive features

**Essential cookies cannot be disabled** without severely impacting your ability to use the website.

## Mobile App Tracking

If you use our mobile app, similar tracking technologies are used:

- **Device identifiers**: Unique IDs for your device
- **SDK integrations**: Third-party analytics and advertising SDKs
- **Local storage**: App preferences and cache

You can manage mobile tracking through your device settings:

**iOS**: Settings → Privacy → Tracking → Disable "Allow Apps to Request to Track"

**Android**: Settings → Google → Ads → Opt out of Ads Personalization

## Cookies and Personal Data

Some cookies may collect personal data. Information collected through cookies is handled according to our [Privacy Policy](/privacy-policy).

We implement appropriate security measures to protect cookie data from unauthorized access.

## International Users

If you access our website from outside [Your Country], please note that cookies may transfer your data to our servers located in [Your Country]. By using the website, you consent to this transfer.

## Children's Privacy

Our services are not directed to children under 13. We do not knowingly collect data from children through cookies. Parents can use browser controls to limit cookie usage.

## Changes to This Cookie Policy

We may update this Cookie Policy to reflect changes in technology, legal requirements, or our practices. Updates will be posted on this page with a new "Last Updated" date.

For significant changes, we may:
- Display a prominent notice on the website
- Send email notifications
- Request renewed consent

## Your Rights

Depending on your location, you may have rights regarding cookies and data collection:

- Right to information about cookie usage
- Right to provide or withdraw consent
- Right to access data collected via cookies
- Right to deletion of cookie data
- Right to object to certain tracking

To exercise these rights, please contact us using the information below.

## Contact Us

If you have questions about our use of cookies:

**Email**: privacy@yourmarketplace.com  
**Phone**: +1 (555) 123-4567  
**Privacy Center**: [Contact Form](/contact)

**Data Protection Officer**:  
Email: dpo@yourmarketplace.com

---

## Cookie Consent Preferences

You can update your cookie preferences at any time by clicking the "Cookie Settings" link in the footer of our website.

**Current Browser Cookie Status**: [View Cookie Settings](#)

---

*By continuing to use our website, you acknowledge that you have read and understood this Cookie Policy.*`,
    status: 'published',
    showInNavigation: true
  },
  {
    title: 'Become a Vendor',
    slug: 'become-a-vendor',
    content: `# Become a Vendor

## Join Our Thriving Marketplace Community

Are you ready to take your business to the next level? Partner with us and reach thousands of customers actively searching for quality products and services. Our marketplace provides everything you need to succeed in online selling.

---

## Why Sell With Us?

### 🌟 Large Customer Base
Access a growing community of engaged shoppers actively looking for products like yours.

### 📈 Easy to Use Platform
Our intuitive vendor dashboard makes it simple to manage your store, track sales, and fulfill orders.

### 💼 Flexible Business Model
Whether you're a small artisan or an established brand, our platform scales with your business.

### 🛡️ Secure Payments
Get paid reliably and securely with our integrated payment processing system.

### 📊 Analytics & Insights
Track your performance with detailed analytics and reports to help you make informed business decisions.

### 🚀 Marketing Support
Benefit from our marketing efforts and promotional campaigns that drive traffic to your products.

### 🎨 Customizable Storefront
Create your unique brand identity with customizable vendor pages and product listings.

### 📞 Dedicated Support
Our vendor support team is here to help you succeed every step of the way.

---

## Vendor Benefits

### Financial Advantages
- **Competitive Commission Rates**: Keep more of what you earn
- **No Upfront Fees**: Start selling with zero initial investment
- **Fast Payouts**: Receive your earnings on a regular schedule
- **Transparent Pricing**: No hidden fees or surprise charges

### Operational Support
- **Easy Product Management**: Upload and manage unlimited products
- **Inventory Tracking**: Real-time inventory management tools
- **Order Management**: Streamlined order processing and fulfillment
- **Shipping Integration**: Connect with major shipping carriers

### Growth Tools
- **SEO Optimization**: Products are optimized for search engines
- **Social Media Integration**: Share products across social platforms
- **Promotional Tools**: Run sales, discounts, and special offers
- **Customer Reviews**: Build trust with verified customer feedback

### Marketing Exposure
- **Featured Listings**: Opportunities for premium placement
- **Email Marketing**: Inclusion in our regular customer newsletters
- **Banner Advertising**: Promote your store across the marketplace
- **Seasonal Campaigns**: Participate in holiday and seasonal promotions

---

## How It Works

### 1. Apply to Become a Vendor
Fill out our simple application form with basic information about your business.

**What you'll need**:
- Business name and description
- Contact information
- Business registration details (if applicable)
- Product categories you plan to sell
- Brief description of your products

### 2. Review & Approval
Our team reviews your application to ensure quality and fit with our marketplace.

**Review criteria**:
- Product quality and uniqueness
- Business legitimacy
- Compliance with our policies
- Category availability

**Timeline**: Most applications are reviewed within 2-3 business days.

### 3. Set Up Your Store
Once approved, access your vendor dashboard and start building your storefront.

**Setup steps**:
- Complete your vendor profile
- Upload your logo and banner
- Add product listings with photos and descriptions
- Set up payment and shipping information
- Configure your store settings

### 4. Start Selling
Your products go live and customers can start purchasing immediately!

**Launch checklist**:
- ✅ At least 5 products listed
- ✅ High-quality product photos
- ✅ Detailed product descriptions
- ✅ Competitive pricing
- ✅ Shipping rates configured
- ✅ Payment method verified

---

## Vendor Requirements

### Eligibility
- Must be 18 years or older
- Valid business registration (for commercial sellers)
- Comply with all applicable laws and regulations
- Provide accurate and truthful information

### Product Standards
- Products must be legal to sell
- High-quality, accurate product images required
- Detailed and honest product descriptions
- Competitive pricing
- No counterfeit or unauthorized items

### Service Standards
- Process orders within 1-2 business days
- Maintain inventory accuracy
- Provide excellent customer service
- Respond to customer inquiries within 24 hours
- Honor return and refund policies

### Policy Compliance
- Adhere to our Terms of Service
- Follow community guidelines
- Respect intellectual property rights
- Maintain professional conduct
- No prohibited items or services

---

## Pricing & Fees

### Commission Structure
Our transparent pricing means you keep more of your profits:

| Sales Volume (Monthly) | Commission Rate |
|------------------------|----------------|
| $0 - $5,000 | 15% |
| $5,001 - $20,000 | 12% |
| $20,001+ | 10% |

### Additional Fees
- **Payment Processing**: 2.9% + $0.30 per transaction (standard rates)
- **Listing Fees**: None - list unlimited products for free
- **Monthly Fees**: None - no subscription required
- **Setup Fees**: None - free to join

### When You Get Paid
- **Payout Schedule**: Weekly or bi-weekly (your choice)
- **Payout Method**: Direct bank transfer
- **Minimum Payout**: $25
- **Currency**: [Your Currency]

*Note: Fees are subject to change. Current vendors will be notified 30 days before any changes.*

---

## Success Stories

### Featured Vendors

**Artisan Jewelry Co.**  
*"Within 3 months, our online sales tripled! The platform is so easy to use and the customer support is amazing."*  
— Sarah M., Jewelry Designer

**TechGadgets Pro**  
*"The analytics tools helped us understand our customers better and optimize our listings. Sales increased by 150% in our first year."*  
— James L., Electronics Retailer

**Organic Beauty Shop**  
*"The marketing exposure we get from the marketplace has been incredible. We went from a small local shop to shipping nationwide."*  
— Maria R., Beauty Brand Owner

**Home Décor Haven**  
*"Best decision we made for our business. The commission rates are fair and the platform takes care of everything technical."*  
— David K., Home Goods Seller

---

## Vendor Resources

### Training & Documentation
- **Vendor Handbook**: Comprehensive guide to using the platform
- **Video Tutorials**: Step-by-step walkthrough videos
- **Webinars**: Live training sessions every month
- **Best Practices**: Tips for maximizing sales

### Support Channels
- **Email Support**: support@yourmarketplace.com
- **Live Chat**: Available during business hours
- **Help Center**: Searchable knowledge base
- **Community Forum**: Connect with other vendors

### Marketing Materials
- **Product Photography Tips**: Guide to taking great photos
- **SEO Guidelines**: Optimize your listings for search
- **Social Media Templates**: Ready-to-use promotional graphics
- **Seasonal Calendars**: Plan ahead for peak selling periods

---

## Prohibited Items

To maintain quality and trust, we do not allow:

- Illegal items or services
- Counterfeit or replica goods
- Stolen property
- Dangerous weapons or explosives
- Controlled substances
- Adult content or services
- Live animals (with some exceptions)
- Recalled or unsafe products
- Unauthorized branded merchandise
- Multi-level marketing schemes

For a complete list, see our [Vendor Agreement](#).

---

## Frequently Asked Questions

### Do I need a business license?
While not always required, having proper business registration is recommended and may be required depending on your location and product type.

### Can I sell internationally?
Yes! You can set up shipping to multiple countries through your vendor dashboard.

### How long does approval take?
Most applications are reviewed within 2-3 business days. Complex cases may take up to a week.

### Can I have multiple stores?
Each vendor account is limited to one store. However, you can sell multiple product categories within your store.

### What if I need help?
Our vendor support team is available via email, live chat, and phone during business hours.

### Can I cancel anytime?
Yes, you can close your vendor account at any time with 30 days notice. Outstanding orders must be fulfilled.

### Are there any exclusive categories?
Some categories may have vendor limits to maintain quality. Check category availability during application.

### Can I offer my own shipping rates?
Yes, you have full control over your shipping rates and methods.

---

## Ready to Get Started?

Join hundreds of successful vendors already selling on our platform!

### Apply Now

[**Start Your Application →**](/vendor/register)

The application takes about 10 minutes to complete. You'll need:
- Basic business information
- Product category details
- Banking information for payments
- Photo ID for verification

---

## Need More Information?

### Contact Our Vendor Relations Team

**Email**: vendors@yourmarketplace.com  
**Phone**: +1 (555) 123-4567 (Mon-Fri, 9am-6pm)  
**Schedule a Call**: [Book a consultation](/#contact)

### Download Our Vendor Information Pack

[📥 Download PDF Guide](#) - Complete overview of vendor benefits, requirements, and success strategies.

---

## Stay Updated

Subscribe to our vendor newsletter for:
- Platform updates and new features
- Selling tips and best practices
- Success stories and case studies
- Upcoming promotional opportunities

[**Subscribe to Vendor Newsletter →**](#)

---

*We look forward to partnering with you and helping your business grow!*`,
    status: 'published',
    showInNavigation: true
  }
];

// Main function
async function seedCustomPages() {
  console.log('🌱 Seeding custom page templates...\n');

  // Create database connection
  const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_DATABASE,
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
  });

  try {
    // Test connection
    await pool.query('SELECT NOW()');
    console.log(`✅ Connected to database: ${process.env.DB_DATABASE}\n`);

    // Insert or update each page
    for (const page of pageTemplates) {
      console.log(`📄 Processing: ${page.title}...`);

      const query = `
        INSERT INTO marketplace_pages (
          id, title, slug, content, status, "showInNavigation", 
          "createdAt", "updatedAt", "publishedAt"
        )
        VALUES (
          gen_random_uuid(), $1, $2, $3, $4, $5, NOW(), NOW(), NOW()
        )
        ON CONFLICT (slug) DO UPDATE SET
          title = EXCLUDED.title,
          content = EXCLUDED.content,
          status = EXCLUDED.status,
          "showInNavigation" = EXCLUDED."showInNavigation",
          "updatedAt" = NOW()
        RETURNING id, slug;
      `;

      const values = [
        page.title,
        page.slug,
        page.content,
        page.status,
        page.showInNavigation
      ];

      const result = await pool.query(query, values);
      console.log(`   ✅ ${page.title} (/${page.slug})`);
    }

    console.log('\n✨ All custom pages seeded successfully!\n');
    console.log('📋 Created/Updated pages:');
    console.log('   • Privacy Policy (/privacy-policy)');
    console.log('   • Terms of Service (/terms-of-service)');
    console.log('   • Cookie Policy (/cookie-policy)');
    console.log('   • Become a Vendor (/become-a-vendor)');
    console.log('\n🌐 Visit your marketplace to view these pages!');

  } catch (error) {
    console.error('❌ Error seeding custom pages:');
    console.error('Error message:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run the script
seedCustomPages();
