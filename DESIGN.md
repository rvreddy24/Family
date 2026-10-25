---
name: FamilyHubs Design System
description: Warm Editorial & Heritage Care for Pan-India Eldercare and NRI Filial Concierge
colors:
  primary: "#C25E2E"
  primary-deep: "#A3481D"
  primary-soft: "#FBECE5"
  secondary: "#1F5C42"
  secondary-soft: "#E8F3EE"
  neutral-bg: "#FAF7F2"
  neutral-surface: "#FFFFFF"
  neutral-card: "#F5F1EB"
  neutral-border: "#E7DFD5"
  text-primary: "#1C1917"
  text-secondary: "#574F49"
  text-muted: "#8C827A"
  gold-escrow: "#B45309"
  gold-escrow-soft: "#FEF3C7"
  crimson-sos: "#B91C1C"
  crimson-sos-soft: "#FEE2E2"
typography:
  display:
    fontFamily: "Eczar, Georgia, serif"
    fontSize: "clamp(2rem, 4vw, 3.25rem)"
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "Eczar, Georgia, serif"
    fontSize: "clamp(1.5rem, 2.5vw, 2.25rem)"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.015em"
  title:
    fontFamily: "Albert Sans, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: 1.35
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Albert Sans, system-ui, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: "normal"
  label:
    fontFamily: "Albert Sans, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "0.02em"
rounded:
  sm: "6px"
  md: "10px"
  lg: "16px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
  xxl: "48px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "#FFFFFF"
    rounded: "{rounded.md}"
    padding: "10px 20px"
  button-primary-hover:
    backgroundColor: "{colors.primary-deep}"
  button-secondary:
    backgroundColor: "{colors.secondary-soft}"
    textColor: "{colors.secondary}"
    rounded: "{rounded.md}"
    padding: "10px 20px"
---

# Design System: FamilyHubs

## Overview

**Creative North Star: "The Filial Sanctuary"**

FamilyHubs rejects the sterile, clinical aesthetic of emergency hospitals and the cold, transactional blue-and-gray grid of gig-worker apps. Instead, the interface draws inspiration from heirloom trust, warmth, and Indian family devotion (*Seva*). The visual environment feels grounded, protective, and unmistakably authentic—reassuring an expatriate daughter or son in London or San Francisco that their parents in Bengaluru, Delhi, or Hyderabad are treated with reverence, safety, and attentive dignity.

The design commits to warm linen and stone backdrops, earthen terracotta and rich saffron focal anchors, and sacred forest emerald reassurance signals. Micro-interactions are deliberate and peaceful rather than nervous or alarmist. The audible experience is purposefully silent; calm visual telemetry replaces anxious ping notifications.

**Key Characteristics:**
- **Warm Textured Canvas**: Natural ivory, calico, and stone grounds (`#FAF7F2`, `#F5F1EB`) replace sterile `#F8FAFC` cold blue-grays.
- **Sculpted Heritage Typography**: Expressive, dignified heading typography in *Eczar* paired with crystal-clear humanist reading typography in *Albert Sans*.
- **Sacred Emerald & Warm Terracotta Hierarchy**: Terracotta (`#C25E2E`) leads intentional action; Forest Emerald (`#1F5C42`) confirms verified safety, live GPS check-in, and escrow lock.
- **Zero AI-Kicker Soup**: No repetitive miniature eyebrow tags over every title; headings declare their purpose directly with scale and weight.
- **No Cards-in-Cards Habit**: Deep flat spatial structure using generous breathing room, warm dividing borders (`#E7DFD5`), and purposeful elevated surfaces only when floating or interacting.

## Colors

The palette balances warm earthen heritage pigments with high-trust operational feedback.

### Primary
- **Heritage Terracotta** (`#C25E2E`): The primary brand tone for key actions, primary booking commitments, and brand warmth.
- **Deep Terracotta** (`#A3481D`): Hover and pressed states for primary triggers.
- **Soft Saffron Blush** (`#FBECE5`): Tinted background for active navigation, active filters, and warm emphasis blocks.

### Secondary
- **Forest Emerald** (`#1F5C42`): Safety, live GPS arrival verification, successfully completed care tasks, and trusted status badges.
- **Emerald Mist** (`#E8F3EE`): Background pill for verified parent check-ins and completed healthcare tasks.

### Neutral
- **Calico Linen Ground** (`#FAF7F2`): Global ambient page surface; soft on the eyes across day and late-night timezone checks.
- **Warm Alabaster** (`#FFFFFF`): Elevated panels, modals, and content containers.
- **Stone Surface** (`#F5F1EB`): Sub-panel backings, table headers, and inactive tab tracks.
- **Warm Linen Border** (`#E7DFD5`): Architectural 1px dividing borders between zones.
- **Charcoal Ink** (`#1C1917`): High-contrast primary reading copy (≥9:1 contrast against `#FAF7F2`).
- **Espresso Secondary** (`#574F49`): Secondary descriptions, helper text, and timestamps (≥5.5:1 contrast).
- **Muted Stone** (`#8C827A`): Inactive placeholders and secondary icons.

### Status & Escrow
- **Heirloom Gold** (`#B45309`): Escrow protection badges, verified partner certificates, and rating stars.
- **Crimson Garnet** (`#B91C1C`): Emergency SOS triggers and frozen platform state indicators.

### Named Rules
**The Warm Harmony Rule.** Gray is never cold or blue-tinted. Every neutral surface, divider, and secondary text tone carries warm yellow/red undertones from the linen and terracotta world.
**The Rarity Rule.** Heritage Terracotta is applied to no more than 15% of the viewport; its warmth commands natural attention without fatiguing the eye.

## Typography

**Display Font:** Eczar (with Georgia, serif fallback)
**Body Font:** Albert Sans (with system-ui, -apple-system, sans-serif fallback)
**Monospace / Numeric Font:** JetBrains Mono (for currency values, OTP verification challenges, and telemetry coordinates)

**Character:** Dignified, literary, and filial. Eczar delivers the graceful calligraphic poise of Indian literary heritage, while Albert Sans ensures effortless scanability and rapid decision-making across high-stakes booking flows.

### Hierarchy
- **Display** (SemiBold 600, clamp(2rem, 4vw, 3.25rem), 1.15 line-height, -0.02em tracking): Welcome hero, major milestone confirmations.
- **Headline** (SemiBold 600, clamp(1.5rem, 2.5vw, 2.25rem), 1.2 line-height, -0.015em tracking): Section titles, modal headers, major statistics.
- **Title** (SemiBold 600, 1.25rem, 1.35 line-height, -0.01em tracking): Task card titles, parent names, service categories.
- **Body** (Regular 400, 0.9375rem, 1.6 line-height): Instructions, medical notes, address details, chat history. Measure constrained between 60–75ch.
- **Label** (Medium/SemiBold 500/600, 0.8125rem, 0.02em tracking): Form labels, navigation tabs, status badges.

### Named Rules
**The No-Kicker Rule.** Section headings speak for themselves. Never place a tiny uppercase tracked eyebrow or kicker above an *Eczar* headline.
**The Numeric Honesty Rule.** All financial amounts ($ / ₹), OTP codes, and GPS coordinates are rendered in tabular figures (`font-variant-numeric: tabular-nums`) with monospace precision.

## Layout

The spatial model uses an architectural layout with 12-column fluid responsive containers (max-width `1280px` on desktop, fluid padding `1rem` mobile to `2rem` desktop).
- **Desktop**: Persistent calm top navigation with filial brand crest, live portal indicator, and direct access to Parents, Bookings, Health, Billing, and Safety Freeze.
- **Mobile**: Touch-first ergonomics with minimum 44px hit-targets, sticky bottom task actions, and instant swipeable task cards.
- **Breathing Space**: Generous vertical separation (24px to 48px between semantic groups; minimum 16px between sibling items).

## Elevation & Depth

Surfaces rely on tonal hierarchy, warm border definition, and soft natural ambient shadows. Hard 4px cartoon drop-shadows and neon blur glows are forbidden.

### Shadow Vocabulary
- **Resting Surface** (`border: 1px solid #E7DFD5; box-shadow: 0 1px 3px rgba(28, 25, 23, 0.04)`): Standard containers, parent cards, and service items.
- **Hover / Interactive** (`box-shadow: 0 4px 12px -2px rgba(194, 94, 46, 0.08), 0 2px 6px -1px rgba(28, 25, 23, 0.04); border-color: #D4622B`): Clickable service offerings and task status cards.
- **Floating Modal / Overlay** (`box-shadow: 0 20px 32px -8px rgba(28, 25, 23, 0.12), 0 8px 16px -4px rgba(28, 25, 23, 0.06)`): Verification proof modals, booking sheets, and emergency dialogs.

## Shapes

- **Card Radii**: Clean, organic 12px to 16px radius (`rounded-xl`).
- **Interactive Controls**: 8px to 10px radius (`rounded-lg`) for buttons and form fields.
- **Pills**: Full circular pill (`rounded-full`) exclusively for status indicators, counter badges, and category filter chips.
- **Dividers**: 1px crisp horizontal hairline in `#E7DFD5`.

## Components

### Buttons
- **Shape**: Subtle curved rectangle (10px radius).
- **Primary**: Terracotta background (`#C25E2E`), crisp white text, hover deepens to `#A3481D`.
- **Secondary**: Soft Forest Emerald background (`#E8F3EE`), Forest Emerald text (`#1F5C42`), hover `#DCEDE5`.
- **Outline / Ghost**: 1px warm border (`#E7DFD5`), charcoal text, hover `#F5F1EB`.
- **Emergency Action**: Deep Crimson Garnet (`#B91C1C`), white bold text, subtle red ambient focus glow.

### Status Chips & Badges
- **Verified / Completed**: Forest Emerald background (`#E8F3EE`), `#1F5C42` text, checkmark icon.
- **Escrow Locked**: Warm Gold background (`#FEF3C7`), `#B45309` text, lock icon.
- **Live In-Progress**: Saffron blush (`#FBECE5`), `#C25E2E` text, animated emerald telemetry dot.

### Cards & Care Summaries
- **Ground**: Warm Alabaster (`#FFFFFF`) sitting on Calico Linen (`#FAF7F2`).
- **No Nested Cards**: Information inside cards is partitioned by clean whitespace, subtle 1px dividers, or gentle tone shifts (`#F5F1EB`), never by nesting another bordered card inside.

### Form Inputs & Dropdowns
- **Surface**: Warm Alabaster (`#FFFFFF`) with 1px border `#E7DFD5`.
- **Focus**: Border shifts to Heritage Terracotta (`#C25E2E`) with a soft 3px ambient ring (`rgba(194, 94, 46, 0.15)`).

## Do's and Don'ts

### Do:
- **Do** honor Indian cultural reverence for elders in copy, imagery, and respectful design details.
- **Do** use Eczar for all major headings and modal titles with balanced sentence case.
- **Do** ensure all text maintains strict WCAG AA/AAA compliance against warm linen grounds.
- **Do** format all currencies with their proper symbols (`$`, `₹`, `£`, `€`) in tabular figures.
- **Do** keep live partner telemetry and GPS maps clear, legible, and accompanied by textual addresses.

### Don't:
- **Don't** use cold clinical hospital blues, generic slate `#F8FAFC`, or harsh pure grays.
- **Don't** stack kicker/eyebrow pills on top of section headings.
- **Don't** nest cards inside cards or construct 4-column metric boxes with identical numbers.
- **Don't** introduce sound effects or noisy audible chimes; FamilyHubs is an intentionally calm, silent experience.
- **Don't** use generic Inter or system sans as a display font.
