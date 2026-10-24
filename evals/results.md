# Accuracy results

Run on 2026-10-24 16:27 UTC against http://localhost:3000.
Models: Nemotron 3 Nano and Super race for planning (the first answer wins, so it varies by question); `nvidia/Nemotron-3-Ultra-550b-a55b` for analysis. Search: Tavily advanced, two queries per check.


**Accuracy: 25/30 (83%)** · Dangerous errors: 1 · Errors: 0

| # | Question | Expected | Got | |
|---|---|---|---|---|
| 1 | Work 18 hours a week at the campus bookstore during the fall semester | likely_allowed | likely_allowed | ✓ |
| 2 | Work full time at the campus library during summer break; I'm enrolled again in the fall | likely_allowed | likely_allowed | ✓ |
| 3 | Work 15 hours at the campus cafeteria and 10 hours as an on-campus research assistant in the same week during the semester | likely_not_allowed | likely_not_allowed | ✓ |
| 4 | Paid summer internship at a tech company related to my major, after my first academic year | needs_authorization | needs_authorization | ✓ |
| 5 | Start an off-campus internship in my first semester as an undergraduate | likely_not_allowed | likely_not_allowed | ✓ |
| 6 | Unpaid internship at a local nonprofit off campus during the semester, related to my major | needs_authorization | needs_authorization | ✓ |
| 7 | Work full time at a U.S. company in my field after graduation, after my OPT EAD card arrives | likely_allowed | likely_allowed | ✓ |
| 8 | Start working at a company after graduation before my OPT application is approved | likely_not_allowed | likely_not_allowed | ✓ |
| 9 | Work as a barista during my post-completion OPT, unrelated to my computer science degree | likely_not_allowed | likely_not_allowed | ✓ |
| 10 | Do paid freelance web development for a client in China while I'm living in Illinois during the semester | needs_authorization | needs_authorization | ✓ |
| 11 | Take paid logo design gigs on Fiverr while studying; my major is chemistry | likely_not_allowed | likely_not_allowed | ✓ |
| 12 | Build websites for paying clients in China while I'm physically in China during winter break | likely_allowed | unclear | ✗ |
| 13 | Sell my used textbooks and furniture online before moving out | likely_allowed | likely_allowed | ✓ |
| 14 | Run an Etsy shop selling jewelry I make, while studying in the U.S. | likely_not_allowed | needs_authorization | ✗ |
| 15 | Earn royalties from a programming book I wrote before coming to the U.S. | unclear | likely_allowed | ⚠ dangerous |
| 16 | Invest my savings in U.S. stocks and index funds | likely_allowed | unclear | ✗ |
| 17 | Buy cryptocurrency with my own money and hold it | likely_allowed | likely_allowed | ✓ |
| 18 | Earn interest from a U.S. high-yield savings account | likely_allowed | likely_allowed | ✓ |
| 19 | Accept a merit scholarship from my university | likely_allowed | likely_allowed | ✓ |
| 20 | Accept cash prize money from winning an online hackathon | unclear | unclear | ✓ |
| 21 | Get paid a stipend as a graduate research assistant in my department, 20 hours a week during the semester | likely_allowed | likely_allowed | ✓ |
| 22 | Volunteer at a local food bank on weekends with no pay or benefits | likely_allowed | unclear | ✗ |
| 23 | I'm a computer science student. Work unpaid as a developer for a for-profit startup in exchange for equity | needs_authorization | needs_authorization | ✓ |
| 24 | Do an unpaid "trial week" at a local restaurant before they decide to hire me | likely_not_allowed | likely_not_allowed | ✓ |
| 25 | Do a paid internship in Shanghai during my summer break while I'm physically in China | likely_allowed | likely_allowed | ✓ |
| 26 | I'm a biology major. Teach English online to students in Japan for money from my dorm room | likely_not_allowed | likely_not_allowed | ✓ |
| 27 | Work at my parents' company in Vietnam while I'm back home for winter break | likely_allowed | likely_allowed | ✓ |
| 28 | Drive for Uber on weekends | likely_not_allowed | likely_not_allowed | ✓ |
| 29 | Deliver food for DoorDash a few hours a week | likely_not_allowed | likely_not_allowed | ✓ |
| 30 | Tutor a high school student in math for cash off campus | likely_not_allowed | likely_not_allowed | ✓ |
