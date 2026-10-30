// Content for the Australian English coach. Topic/scenario ids must match api/_coach.js.
const TOPICS = [
  { id: 'daily', label: 'Daily conversation' },
  { id: 'smalltalk', label: 'Small talk with colleagues' },
  { id: 'slang', label: 'Australian slang' },
  { id: 'culture', label: 'Personal stories & culture' },
  { id: 'weekend', label: 'Weekend chat' },
  { id: 'business', label: 'Business English' },
  { id: 'meetings', label: 'Meetings & follow-ups' },
  { id: 'workplace', label: 'Workplace situations' },
];

const SCENARIOS = [
  { id: 'newhire', label: 'New hire starting Monday' },
  { id: 'urgent', label: 'Urgent report request' },
  { id: 'missingdoc', label: 'Missing 201 document' },
  { id: 'rough', label: 'Checking in after a hard week' },
  { id: 'event', label: 'Planning a team lunch' },
  { id: 'surprise', label: 'Surprise me' },
];

const STAGES = [
  'Casual opening', 'Weekly accomplishments', 'Onboarding updates', '201 filing', 'Pending documents',
  'NBI & requirements', 'Challenges & solutions', "Next week's priorities", 'Manager follow-ups',
];

// Repeat-after-me sentences, grouped
const SENTENCES = {
  'Small talk': [
    "G'day! How was your weekend?",
    "Not too bad, thanks. How are you going?",
    "It's been a busy week, but I'm getting there.",
    'Did you get up to anything fun on the weekend?',
    'Want to grab a coffee this arvo?',
    "No worries, I'll catch you later.",
  ],
  'Weekly updates': [
    'This week I finished onboarding two new starters.',
    "I've updated all the 201 files except one.",
    "We're still waiting on three NBI clearances.",
    'The payroll report went out on Wednesday.',
    "Onboarding is tracking well. We're on schedule.",
    'Next week my priority is closing out the pending documents.',
  ],
  'Asking for help': [
    'Could you run me through the new process?',
    'Sorry, could you say that again a bit slower?',
    'Just to clarify, do you need it by Friday?',
    'Would you mind having a quick look at this?',
    "I'm not across that yet, but I'll find out.",
    'Can I run something past you?',
  ],
  Meetings: [
    'Can I just jump in with a quick update?',
    "That's a fair point. I reckon we could try both.",
    "I'll touch base with the team and get back to you.",
    "Let's park that for now and come back to it.",
    'Happy to take that on.',
    'What are the next steps on this one?',
  ],
  'Phone calls': [
    'Hi, have you got a quick minute?',
    'Sorry, you cut out there for a second.',
    "I'll send you a quick email to confirm.",
    'Thanks for the heads up.',
    "Sorry, I didn't quite catch that.",
    'Talk soon. Cheers!',
  ],
};

// Listening comprehension: the first option is the correct one (options are shuffled on screen)
const LISTENING = [
  { say: "I'm flat out this arvo. Can we touch base tomorrow morning?", q: 'What does your colleague want?', options: ['To talk tomorrow morning', 'To talk this afternoon', 'To cancel the meeting', 'To go out for lunch'] },
  { say: "No dramas, I'll have it to you by COB.", q: 'When will it be ready?', options: ['By the end of today', 'Tomorrow morning', 'Next week', "It's already done"] },
  { say: "How did you go with the new starter's paperwork?", q: 'What is your manager asking?', options: ['How the paperwork went', 'Where you went yesterday', 'If you want to go home', 'Who the new starter is'] },
  { say: 'Reckon we could push the meeting back half an hour?', q: 'What is the suggestion?', options: ['Start 30 minutes later', 'Start 30 minutes earlier', 'Cancel the meeting', 'Make the meeting shorter'] },
  { say: 'Good on ya for getting all those files sorted.', q: 'How does your manager feel?', options: ['Pleased with your work', 'Annoyed with you', 'Confused about the files', 'Worried about a deadline'] },
  { say: 'Can you loop me in on the email to the new hire?', q: 'What should you do?', options: ['Add your manager to the email', 'Delete the email', 'Call the new hire', 'Print the email'] },
  { say: "I'm keen to hear how onboarding's tracking.", q: 'What does your manager want?', options: ['An update on onboarding', 'To stop onboarding', 'To hire more people', 'A list of new staff names'] },
  { say: "Fair enough. Let's park it and come back to it next week.", q: 'What will happen?', options: ["They'll discuss it next week", "They'll decide today", "It's cancelled for good", 'The speaker strongly disagrees'] },
];

// reg: 'work' = safe at work · 'casual' = fine with colleagues, not in formal settings · 'avoid' = avoid at work
const SLANG_GUIDE = [
  { t: "G'day", say: "g'DAY", en: 'Hello.', fil: 'Hello / Kumusta', work: "G'day Sarah, how's your week going?", life: "G'day mate!", reg: 'work' },
  { t: 'No worries', say: 'no WUH-reez', en: "You're welcome; no problem; that's OK.", fil: 'Walang anuman / Okay lang', work: '"Thanks for sending that." "No worries!"', life: '"Sorry I\'m late." "No worries."', reg: 'work' },
  { t: 'How are you going?', say: 'how-ya-GOH-in', en: 'How are you? A greeting, not a real question. Answer briefly: "Good thanks, you?"', fil: 'Kumusta ka?', work: 'Morning! How are you going?', life: 'How are you going, mate?', reg: 'work' },
  { t: 'Arvo', say: 'AH-voh', en: 'Afternoon.', fil: 'Hapon', work: "I'll send the report this arvo.", life: 'Footy this arvo?', reg: 'casual' },
  { t: 'Reckon', say: 'REK-un', en: 'Think; believe.', fil: 'Sa tingin ko', work: 'I reckon we can finish onboarding by Friday.', life: "Reckon it'll rain?", reg: 'work' },
  { t: 'Flat out', say: 'flat OUT', en: 'Extremely busy.', fil: 'Sobrang busy', work: "I've been flat out with onboarding this week.", life: 'Flat out like a lizard drinking! (very busy)', reg: 'work' },
  { t: 'Mate', say: 'mayt', en: 'Friend; a friendly way to address someone.', fil: 'Pare / Kaibigan', work: 'Cheers, mate. (with peers)', life: 'How are you going, mate?', reg: 'casual' },
  { t: 'Good on ya', say: 'good ON-ya', en: 'Well done; good for you.', fil: 'Galing mo! / Buti naman', work: 'You finished all the 201 files? Good on ya!', life: 'You ran a marathon? Good on ya!', reg: 'work' },
  { t: 'Keen', say: 'keen', en: 'Eager; interested.', fil: 'Gusto / Interesado', work: "I'm keen to learn the new payroll system.", life: 'Keen for a coffee?', reg: 'work' },
  { t: 'Fair enough', say: 'fair-ee-NUFF', en: "That's reasonable; I accept that.", fil: 'Sige, may punto ka', work: '"We need more time for the NBI clearances." "Fair enough."', life: '"I\'m too tired to go out." "Fair enough."', reg: 'work' },
  { t: 'How did you go?', say: "how'd-ya-GO", en: 'How did it turn out? (not about travel)', fil: 'Kumusta naman? Ano ang nangyari?', work: "How did you go with the new starter's paperwork?", life: 'How did you go in your exam?', reg: 'work' },
  { t: 'Touch base', say: 'tuch BAYS', en: 'Briefly contact someone or check in.', fil: 'Mag-usap saglit / Mag-update', work: "Let's touch base on Friday about onboarding.", life: "I'll touch base when I'm back from holiday.", reg: 'work' },
  { t: 'Cheers', say: 'cheerz', en: 'Thanks; also goodbye.', fil: 'Salamat / Sige, bye', work: 'Cheers for sending that through.', life: 'Cheers, see ya!', reg: 'work' },
  { t: 'No dramas', say: 'no DRAH-muz', en: 'No problem.', fil: 'Walang problema', work: '"Can you update the tracker?" "No dramas."', life: '"Can you pick me up?" "No dramas."', reg: 'work' },
  { t: 'Heaps', say: 'heeps', en: 'A lot; very.', fil: 'Sobrang dami / Napaka-', work: 'Thanks heaps for your help.', life: 'There were heaps of people there.', reg: 'work' },
  { t: 'Too easy', say: 'too EE-zee', en: 'No problem, happy to.', fil: 'Ang dali lang / Sige', work: '"Can you send it by three?" "Too easy."', life: '"Meet at six?" "Too easy."', reg: 'work' },
  { t: "I'm across it", say: "I'm a-KROSS it", en: "I know about it and I'm handling it.", fil: 'Alam ko iyan at inaasikaso ko na', work: '"Are you across the new leave policy?" "Yep, I\'m across it."', life: '', reg: 'work' },
  { t: 'COB', say: 'see-oh-BEE', en: 'Close of business: the end of the working day.', fil: 'Bago matapos ang trabaho ngayong araw', work: 'Can you send the report by COB?', life: '', reg: 'work' },
  { t: 'Heads up', say: 'HEDZ up', en: 'Advance warning.', fil: 'Paalala nang maaga', work: 'Just a heads up, the new hire starts Monday.', life: 'Heads up, the shop closes early today.', reg: 'work' },
  { t: 'Run it past', say: 'run it PAST', en: 'Ask someone to check or approve something.', fil: 'Ipa-check muna', work: 'Can I run the onboarding checklist past you?', life: '', reg: 'work' },
  { t: 'Loop in', say: 'loop IN', en: 'Include someone in an email or conversation.', fil: 'Isama sa usapan o email', work: 'Please loop me in on that email.', life: '', reg: 'work' },
  { t: "She'll be right", say: 'shee-ll-be-RITE', en: "It'll be OK. Can sound careless if the problem is serious.", fil: 'Magiging okay din iyan', work: "Don't stress about the move, she'll be right.", life: "Bit of rain? She'll be right.", reg: 'casual' },
  { t: 'Smoko', say: 'SMOH-koh', en: 'A short break at work.', fil: 'Break / Merienda time', work: "Let's chat at smoko.", life: '', reg: 'casual' },
  { t: 'Shout', say: 'showt', en: 'To pay for someone (a coffee, a round of drinks).', fil: 'Libre / Ililibre kita', work: "Coffee's my shout today.", life: 'Your shout next time!', reg: 'casual' },
  { t: 'Yeah, nah', say: 'yeah-NAH', en: 'No (a soft, friendly no).', fil: 'Hindi (malumanay na pagtanggi)', work: '', life: '"Another coffee?" "Yeah, nah, I\'m good."', reg: 'casual' },
  { t: 'Brekkie', say: 'BREK-ee', en: 'Breakfast.', fil: 'Almusal', work: '', life: 'Grab brekkie before work?', reg: 'casual' },
  { t: 'Chockers', say: 'CHOK-uz', en: 'Very full or crowded.', fil: 'Siksikan / Punong-puno', work: 'My calendar is chockers today.', life: 'The train was chockers.', reg: 'casual' },
  { t: 'Sickie', say: 'SIK-ee', en: 'A day off "sick", often implying it\'s fake. Say "I\'m taking a sick day" instead.', fil: 'Kunwaring may sakit para umabsent', work: 'Say: "I\'m unwell today, so I\'m taking a sick day."', life: 'He chucked a sickie on Friday.', reg: 'avoid' },
  { t: 'Bloody', say: 'BLUD-ee', en: 'Very. A mild swear word.', fil: 'Sobrang (pamura)', work: 'Avoid with managers and clients.', life: "It's bloody hot today!", reg: 'avoid' },
];

const CULTURE = [
  { h: '"How are you going?" is just hello', p: 'Answer short and positive, "Good thanks, you?", rather than a full update on your day.' },
  { h: 'First names, even for the boss', p: 'Australian workplaces are informal. Call your manager by first name. "Sir" or "Ma\'am" can feel too formal.' },
  { h: 'Direct, but softened', p: 'Australians soften requests: "Would you mind…", "Just wondering if…", "No rush, but…". Use these instead of blunt commands.' },
  { h: 'Banter and understatement', p: 'Friendly teasing is a sign you belong. "Not bad" often means good. A smile and a light comeback is perfect.' },
  { h: "Don't oversell yourself", p: 'Bragging is frowned upon (the "tall poppy" idea). Share wins plainly: "We got all the files done this week."' },
  { h: 'Shouts and morning tea', p: '"My shout" means I\'ll pay. Bringing food to share for morning tea, or to a "bring a plate" event, is common.' },
];
