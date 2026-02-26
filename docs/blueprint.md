# **App Name**: EduFin Insights

## Core Features:

- User & Network Setup: Allow administrators to register their municipal education network, define the fiscal year, and manage user access roles (Admin, Financial Tech, Viewer). This feature includes Firebase Auth for secure login and Firestore for storing network configuration.
- Funding Parameters Management: Enable administrators to configure and adjust critical funding parameters (FUNDEB VAAF/VAAT, PNAE, PNATE, MDE) specific to their municipal network using intuitive forms, with data stored in Firestore.
- School Census Data Import: Facilitate the upload and processing of INEP School Census microdata files (CSV) or a simplified Excel template. The system filters and consolidates matrícula information by school and educational segment, storing it in Firestore.
- Automated Revenue Calculation: Automatically calculate and display detailed revenue streams (FUNDEB, VAAT, PNAE, MDE, QSE) for each school based on configured parameters and imported matriculation data, storing computed revenues in Firestore.
- Expense Management: Provide an interface for financial technicians to manually input or batch import school-level expenditure data across various categories. All expense records are stored in Firestore.
- Financial Viability Analysis: Generate key financial metrics for each school and the entire network, including cost-per-student, total revenue/expense, balance, and coverage ratios, providing diagnostic statuses (surplus, attention, deficit).
- AI-Powered Narrative Reporting Tool: Leverage a generative AI tool to produce an executive narrative report. This report summarizes the network's financial health, identifies key risks, highlights schools needing attention, and recommends strategies for ETI expansion.

## Style Guidelines:

- Primary Color: A solid, institutional blue (#2266B9) to convey professionalism and reliability, chosen for its clear association with education and finance.
- Background Color: A very light, desaturated blue (#EEF1F6) providing a clean and professional backdrop, enhancing readability in a light theme as requested.
- Accent Color: A deep purple-blue (#362472) used for highlighting key elements and actions. This color creates a strong contrast and sense of depth while remaining harmonious with the primary blue without being teal.
- Headline Font: 'Space Grotesk' (sans-serif) for its modern, techy, and scientific feel, ideal for displaying financial data and analytical insights.
- Body Font: 'Inter' (sans-serif) for body text and reports, chosen for its neutral, objective, and highly readable characteristics, suitable for detailed financial discussions.
- Use a consistent set of clean, professional line-art or filled icons for navigation, data actions (upload, download), and status indicators. Leverage colors provided in the prompt (#00703C for success, #C0392B for danger, #F39C12 for warning) for clear status communication.
- The layout features a persistent sidebar for navigation across modules. Content areas prioritize clear data presentation through tables, interactive charts, and cards for key performance indicators (KPIs), designed for tablet responsiveness and ease of printing.
- Incorporate subtle and functional animations to improve user experience, such as smooth transitions for data loading, filtering actions, form submissions, and notifications, ensuring they are non-distracting.