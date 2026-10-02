/**
 * Benchmark fixtures for the style-transfer engine.
 *
 * BRIEFING_BENCHMARK is a formal UK–Nigeria science and technology briefing
 * note of roughly 1,050 words: numbered sections, named institutions, dates, a
 * US$5 million figure, hedged claims, recommendations and a reference list.
 *
 * Everything in this file is synthetic test material. None of it is genuine
 * calibration writing and none of it may ever be stored as style evidence.
 */

export const BRIEFING_BENCHMARK = `Briefing note: UK–Nigeria science and technology partnership opportunities under STA-S

1. Opportunity areas

Post-harvest and agrifood technology commercialisation offers a near-term route from Nigerian research into market use. Nigerian research institutes have developed storage, preservation and processing technologies over several decades, but few of these technologies have reached farmers or processors at scale. The Federal Institute of Industrial Research Oshodi (FIIRO) and the Nigerian Stored Products Research Institute (NSPRI) both hold portfolios of validated prototypes, including hermetic storage systems, solar dryers and cassava processing equipment. Evidence from the 2023 National Agricultural Technology Review suggests that post-harvest losses for perishable crops may exceed 40% in some states, which indicates a large addressable market for technologies that already exist.

Digital sensing and data tools for crop storage form a second opportunity area. Low-cost sensors could allow aggregators to monitor temperature and humidity in warehouses, and UK firms have relevant expertise in hardware design and data platforms. However, this area is less mature than post-harvest equipment. It should be treated as a complementary activity and should not be the lead investment until demand from Nigerian manufacturers has been demonstrated.

2. Why this fits STA-S

The Science and Technology Accelerator for Sustainability (STA-S) was designed to move existing research into use, not to fund new discovery research. Post-harvest technology commercialisation matches this purpose because the underlying research has already been completed and validated in Nigerian institutions. The binding constraint is not knowledge but the absence of manufacturing partnerships, product certification and early-stage finance.

STA-S also requires that supported activities demonstrate mutual benefit. UK universities and firms would gain access to field validation environments and to a growing market for agrifood equipment, while Nigerian partners would gain design-for-manufacture expertise and links to investors. The programme guidance published in March 2024 states that proposals must show a credible route to commercial adoption within three years. The opportunity described here is likely to meet that test, because several of the candidate technologies have already been trialled with farmer cooperatives.

3. Partners and why

Three groups of partners are needed. Research institutes hold the technologies and the technical staff. FIIRO and NSPRI are the strongest candidates because both have dedicated technology transfer units, although neither unit has completed a commercial licensing agreement since 2019. Manufacturers are needed to produce equipment at a price that smallholder cooperatives can afford. The Manufacturers Association of Nigeria (MAN) could identify fabrication firms in Lagos, Kano and Aba with the capacity to produce at volume.

Policy and standards bodies form the third group. The Federal Ministry of Innovation, Science and Technology (FMIST) sets the national research commercialisation policy, and the Standards Organisation of Nigeria (SON) certifies equipment before it can be sold. Without early involvement from SON, certified products may not reach the market within the programme period. On the UK side, Innovate UK and the Natural Resources Institute at the University of Greenwich have worked on comparable post-harvest programmes in Ghana and Kenya, and their experience should inform the design of the demonstrator.

4. Demonstrator

A single demonstrator is recommended in place of a broad portfolio of small grants. The demonstrator would take three validated technologies from prototype to certified product over 24 months. It would be delivered by a consortium of one research institute, two manufacturers and one UK technical partner, and it would be overseen by a joint steering group that meets quarterly.

The indicative budget is US$5 million. Approximately 45% of this amount would support design-for-manufacture and tooling, 30% would fund certification and field trials, and the remaining 25% would cover commercial development, including distribution agreements with farmer cooperatives. The demonstrator should begin with a six-month selection phase, starting in January 2026, in which candidate technologies are assessed against market demand and manufacturing readiness. Technologies that do not pass this assessment should not proceed to the tooling phase.

Digital sensing should be included only as an optional module. It should be funded only if at least one manufacturer commits to integrating sensors into a certified storage product. This condition protects the budget from being diverted into a technology that the market has not yet requested.

5. Risks and mitigation

The principal risk is that manufacturers will not invest in tooling without confirmed orders. This risk could be reduced through advance purchase commitments from state agricultural development programmes, which have procured storage equipment in the past. A second risk is that intellectual property arrangements between institutes and manufacturers remain unclear. Current institute policies do not specify how licensing revenue is shared, and this has delayed earlier agreements. The demonstrator should therefore require a signed licensing framework before any tooling funds are released.

Exchange rate volatility is a third risk, because imported components are priced in US dollars. Budget lines for tooling should be held in a hard currency account, and procurement should be scheduled early in each phase. Finally, there is a risk that certification takes longer than planned. SON has indicated that new equipment categories may require up to nine months for approval, so certification applications must be submitted no later than month 10.

6. Early indicators of success

Progress should be judged against a small number of indicators that can be observed within the first 12 months. The first indicator is the number of technologies that pass the selection phase with a named manufacturing partner. The second is the signing of at least two licensing agreements between a research institute and a manufacturer. The third is the submission of certification applications to SON for each selected technology.

Later indicators, such as units sold and reductions in post-harvest losses, will not be measurable until after month 18. These should be tracked but should not be used to judge early performance. If fewer than two technologies pass the selection phase, the steering group should review whether the demonstrator remains viable before further funds are committed.

References

Federal Ministry of Innovation, Science and Technology. (2022). National Policy on Research Commercialisation. Abuja: FMIST.

National Agricultural Technology Review. (2023). Post-harvest losses and technology adoption in Nigeria. Abuja.

UK Department for Science, Innovation and Technology. (2024). STA-S programme guidance. London: DSIT. https://www.gov.uk/government/publications/sta-s-programme-guidance`;

/**
 * Stand-in calibration writing for tests and local benchmarks: one sample per
 * core task, including a deliberately conversational personal sample with the
 * fillers, missing apostrophes and conjunction runs that must not transfer.
 */
export const SYNTHETIC_CALIBRATION: Array<{ taskType: "personal" | "explanation" | "argument" | "revision"; text: string }> = [
  { taskType: "personal", text: "Yesterday I woke up late and I think that set the tone for the whole day. I made tea and toast and eggs and then sat by the window for a while, because the rain hasnt stopped all week and I guess I just wanted to watch it. After that I walked to the market. It was crowded. I bought tomatoes and onions and peppers, and when I got home I cooked a stew that took far longer than I planned, although it turned out well in the end. In the evening I called my sister. We talked for an hour about nothing in particular, which is honestly my favourite kind of call. By ten I was asleep." },
  { taskType: "explanation", text: "A budget is not a list of what you want to spend. It is a decision about what matters, made before the money arrives. When a household writes one down, three things usually happen: the fixed costs become visible, the small leaks become visible, and the argument about priorities finally has something concrete to point at. Most people skip the second step. They record rent and transport, because those are obvious, but they ignore the daily purchases that add up to more than either. So the first month of budgeting is really a month of noticing. Only after that does planning make sense, since a plan built on guesses will fail by the second week. If the numbers are honest, the plan can be simple." },
  { taskType: "argument", text: "Cities should charge for parking at the kerb, even where it has always been free. The space is not free to provide. Someone pays to pave it, light it and police it, and at the moment that someone is every resident, including those who do not own a car. When a price is set, even a low one, drivers stay for shorter periods and spaces turn over, which helps the shops that depend on passing trade. Critics say that charges punish poorer drivers. That concern is real, but it can be met with resident permits and discounts, without giving up the principle. Free parking hides a cost. Pricing it brings the cost into the open, where it can be debated and adjusted." },
  { taskType: "revision", text: "The meeting took place on Tuesday, and most of the neighbourhood came. People raised a range of issues, but one decision stood out: the community garden will continue. Nobody argued against it. The garden gives residents fresh produce, a reason to meet, and a shared space that would otherwise sit empty, so the case was easy to make. What remains unclear is who will coordinate the volunteers once the current organiser steps down. That question was left for the next meeting. Until then, the existing rota stays in place, and anyone who wants a plot should add their name to the list at the library." },
];

/**
 * A recorded Workers AI result for BRIEFING_BENCHMARK (model output selected by
 * the pipeline on a local benchmark run with SYNTHETIC_CALIBRATION as the
 * writer). Replayed by tests so the whole pipeline can be exercised offline.
 * Model output: never style evidence.
 */
export const BRIEFING_BENCHMARK_RECORDED_OUTPUT = `Briefing note: UK–Nigeria science and technology partnership opportunities under STA-S

1. Opportunity areas

Commercialising post-harvest and agrifood technology offers a near-term route from Nigerian research into market use. Nigerian research institutes have developed storage, preservation and processing technologies over several decades, although few of these technologies have reached farmers or processors at scale. Both the Federal Institute of Industrial Research Oshodi (FIIRO) and the Nigerian Stored Products Research Institute (NSPRI) hold portfolios of validated prototypes. These include hermetic storage systems, solar dryers and cassava processing equipment. Post-harvest losses for perishable crops may exceed 40% in some states, according to the 2023 National Agricultural Technology Review. This suggests a large addressable market for technologies that already exist.

The second opportunity area involves digital sensing and data tools for crop storage. Aggregators could monitor temperature and humidity in warehouses if low-cost sensors are used. UK firms have relevant expertise in hardware design and data platforms. This area is less mature than post-harvest equipment. It should be treated as a complementary activity. Investment should not be the lead until demand from Nigerian manufacturers has been demonstrated.

2. Why this fits STA-S

The Science and Technology Accelerator for Sustainability (STA-S) was not designed to fund new discovery research. Instead, it was designed to move existing research into use. Post-harvest technology commercialisation matches this purpose. This is because the underlying research has already been completed and validated in Nigerian institutions. The binding constraint is not knowledge. Rather, it is the absence of manufacturing partnerships, product certification and early-stage finance.

Supported activities also require that they demonstrate mutual benefit. UK universities and firms would gain access to field validation environments and to a growing market for agrifood equipment. Nigerian partners would gain design-for-manufacture expertise and links to investors. Proposals must show a credible route to commercial adoption within three years, according to the programme guidance published in March 2024. Because several of the candidate technologies have already been trialled with farmer cooperatives, the opportunity described here is likely to meet that test.

3. Partners and why

Three groups of partners are needed. FIIRO and NSPRI are the strongest candidates because both have dedicated technology transfer units, although neither unit has completed a commercial licensing agreement since 2019. Technologies and technical staff are held by research institutes. Manufacturers are needed to produce equipment at a price that smallholder cooperatives can afford. Fabrication firms in Lagos, Kano and Aba with the capacity to produce at volume could be identified by the Manufacturers Association of Nigeria (MAN).

The third group is formed by policy and standards bodies. The national research commercialisation policy is set by the Federal Ministry of Innovation, Science and Technology (FMIST), and equipment is certified by the Standards Organisation of Nigeria (SON) before it can be sold. Certified products may not reach the market within the programme period if SON is not involved early. The design of the demonstrator should be informed by the experience of Innovate UK and the Natural Resources Institute at the University of Greenwich. These organisations have worked on comparable post-harvest programmes in Ghana and Kenya.

4. Demonstrator

A single demonstrator is recommended instead of a broad portfolio of small grants. Three validated technologies would be taken from prototype to certified product by the demonstrator over 24 months. A consortium of one research institute, two manufacturers and one UK technical partner would deliver it. A joint steering group that meets quarterly would oversee the work.

The indicative budget is US$5 million. About 45% of this amount would support design-for-manufacture and tooling, and 30% would fund certification and field trials. The remaining 25% would cover commercial development, including distribution agreements with farmer cooperatives. In January 2026, the demonstrator should begin with a six-month selection phase. During this phase, candidate technologies are assessed against market demand and manufacturing readiness. Technologies should not proceed to the tooling phase if they do not pass this assessment.

Digital sensing should be included only as an optional module. It should be funded only if at least one manufacturer commits to integrating sensors into a certified storage product. This condition protects the budget from being diverted into a technology that the market has not yet requested.

5. Risks and mitigation

Manufacturers will not invest in tooling without confirmed orders, which is the principal risk. This risk could be reduced through advance purchase commitments from state agricultural development programmes. These programmes have procured storage equipment in the past.

Intellectual property arrangements between institutes and manufacturers remain unclear, and this is a second risk. Current institute policies do not specify how licensing revenue is shared, and this has delayed earlier agreements. The demonstrator should therefore require a signed licensing framework before any tooling funds are released.

Because imported components are priced in US dollars, exchange rate volatility is a third risk. Procurement should be scheduled early in each phase, and budget lines for tooling should be held in a hard currency account. Finally, there is a risk that certification takes longer than planned. SON has indicated that new equipment categories may require up to nine months for approval, so certification applications must be submitted no later than month 10.

6. Early indicators of success

Within the first 12 months, progress should be judged against a small number of indicators. The number of technologies that pass the selection phase with a named manufacturing partner is the first indicator. The second is when at least two licensing agreements are signed between a research institute and a manufacturer. Certification applications to SON for each selected technology represent the third indicator.

Later indicators include units sold and reductions in post-harvest losses. These will not be measurable until after month 18. Although these should be tracked, early performance should not be judged by them. The steering group should review whether the demonstrator remains viable before further funds are committed if fewer than two technologies pass the selection phase.

References

Federal Ministry of Innovation, Science and Technology. (2022). National Policy on Research Commercialisation. Abuja: FMIST.

National Agricultural Technology Review. (2023). Post-harvest losses and technology adoption in Nigeria. Abuja.

UK Department for Science, Innovation and Technology. (2024). STA-S programme guidance. London: DSIT. https://www.gov.uk/government/publications/sta-s-programme-guidance`;
