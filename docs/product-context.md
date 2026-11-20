# nakade — Product Context

- **Product name:** nakade
- **Website:** https://nakade.app
- **Product:** Interactive relocation discovery and planning platform
- **Initial market:** Bulgaria
- **Stage:** Hackathon concept

## 1. Product Vision

nakade helps people discover where they could live a better life, understand what living there might actually look like, and prepare for relocation.

The platform combines personal preferences with trustworthy public data to identify suitable cities, towns, and villages across Bulgaria.

It supports relocation in any direction: city to village, village to city, large city to small town, or vice versa.

**Core experience:** Discover your place → Try your life there → Plan your move.

The goal is to make relocation an engaging, informed, and personalized experience rather than a stressful decision based on scattered information.

## 2. Two Main User Journeys

### A. I Already Know Where I Want to Move

The user has a specific destination in mind.

Example: "I live in Sofia and want to move to Tryavna."

Experience:

1. Select current location and desired destination.
2. Build a personal profile.
3. Explore how well the destination fits their needs.
4. Discover advantages, disadvantages, and trade-offs.
5. Try an interactive simulation of everyday life there.
6. Receive a personalized relocation plan.

Users can also explore alternative destinations if their original choice does not meet their expectations.

### B. Help Me Find My Place

The user knows how they want to live but doesn't know where.

Example: "I want a peaceful place surrounded by nature, but I still need good access to essential services."

Experience:

1. Describe lifestyle preferences and personal needs.
2. Build a personal profile.
3. Receive personalized location suggestions.
4. Discover destinations through Tinder-style swipe cards.
5. Save interesting places and explore their details.
6. Simulate everyday life in selected locations.
7. Choose a destination and receive a relocation plan.

Both journeys share the same core experience, and users can move between them.

## 3. Personalized Onboarding

Users can choose between two onboarding modes.

### Quick Match

Approximately five essential questions covering:

- Household and family situation
- Employment and working arrangements
- Access to a car
- Most important lifestyle priorities
- Non-negotiable requirements

Designed to get users into the experience quickly.

### Detailed Match

A more comprehensive, adaptive questionnaire covering additional topics:

- Housing preferences and budget
- Commuting requirements
- Education and healthcare needs
- Everyday amenities
- Nature and community preferences
- Important personal connections
- Acceptable lifestyle compromises

### Confirmed feature: Progressive profiling

Users can start with Quick Match and upgrade to Detailed Match at any point.

Their previous answers, saved locations, and progress remain intact. Additional answers refine their recommendations.

Questions should adapt to the user's situation rather than being identical for everyone.

## 4. Location Discovery — Tinder-Style Swipe

One of the product's two signature interactive features.

Users explore locations through visual, swipeable cards instead of conventional search results.

Each card introduces a settlement and highlights:

- What makes it interesting
- How it fits the user's lifestyle
- Relevant advantages and trade-offs
- Key facts supported by public data

Users can like, dislike, save, or explore locations.

The experience should feel like discovering potential future homes, not browsing a statistical database.

## 5. Try Your New Life — Interactive Simulation

The second signature feature.

After choosing a location, users can experience an interactive representation of what a typical day there might look like.

The experience explores situations such as:

- Starting the morning in the new location
- Getting to work or accessing employment opportunities
- Shopping and accessing essential services
- Taking children to school
- Exploring nearby nature and leisure opportunities
- Understanding everyday transportation needs

The simulation adapts to each user's personal profile.

**Important:** It uses actual location information where available, clearly distinguishing real facts from hypothetical scenarios.

The objective is to help users imagine and evaluate everyday life before committing to a move.

## 6. Core Business Logic

The product connects two things: **what the user wants** and **what a location can realistically offer**.

Personal preferences determine which characteristics matter most.

Public data provides evidence about the characteristics of each location.

The initial evaluation dimensions under consideration are:

1. Transportation and accessibility
2. Healthcare
3. Education
4. Everyday amenities
5. Nature and environment
6. Employment and economic opportunities
7. Demographics and settlement development

Some user requirements are preferences, while others are mandatory constraints.

Recommendations should explain why a location fits, where compromises exist, and what information remains uncertain.

The system should never invent local facts or present estimates as verified information.

### Initial Geographic Scope

The current proposed MVP focuses on approximately:

- 30 primary cities and towns
- 3–5 nearby villages per city

Villages are evaluated in relation to their surrounding area, not only the services within their boundaries.

For example, a village without a hospital may still offer reasonable healthcare access if one is available in a nearby town.

The final location selection and evaluation methodology remain open.

## 7. Relocation Planning

Once users identify a preferred destination, the experience continues beyond discovery.

The platform provides a personalized relocation checklist or action plan based on their circumstances.

Potential topics include housing, employment, healthcare, education, transportation, administrative steps, and adapting to the new community.

The intention is to support the transition from "I want to live there" to "Here's how I can make it happen."

## 8. Product Experience Principles

- **Interactive first:** Avoid long, boring forms and static dashboards.
- **Progressive discovery:** Collect information naturally throughout the experience.
- **Personalized:** Different people should have different journeys and recommendations.
- **Data-grounded:** Public data is fundamental to the product's value.
- **Transparent:** Explain recommendations and distinguish facts from assumptions.
- **Exploratory:** Let users compare places, change preferences, and reconsider decisions.
- **Practical:** The experience should lead toward an actionable relocation decision.

## 9. Current Product Decisions

### Confirmed

- Two primary user journeys
- Quick Match and Detailed Match
- Upgrade from Quick to Detailed without losing progress
- Tinder-style location discovery
- Interactive "Try Your New Life" simulation
- Personalized relocation planning
- Real public data as the foundation of location recommendations

### Proposed, not finalized

- Approximately 30 cities and 3–5 surrounding villages each
- Seven initial evaluation dimensions
- Exact onboarding questions and branching
- Swipe-card content and simulation interactions
- Final scope of the hackathon prototype

Technical architecture, backend design, data processing, and implementation decisions are intentionally outside the scope of this document.

## Core value proposition

nakade doesn't just help you find somewhere to live. It helps you discover where your desired life could become reality, experience that possibility, and take the first steps toward making it happen.
