"""The call script as code: which detail to ask for next, and when the model is needed.

A 3B model on a Raspberry Pi is too slow and too forgetful to run the whole
intake by itself. So the flow is plain code:

- When the caller simply answers the question, the assistant replies straight
  away with a short thank-you and the next question. No model call, so no
  waiting on the Pi.
- When the caller asks something ("How much does it cost?", "Are you a robot?",
  "Does my mom qualify?"), the local LLM answers from the fact sheet, and then
  the script asks the next question.
- Emergencies, the phone number read-back and the goodbye are fixed sentences.

Edit the wording of the questions below if you want the assistant to say
things differently.
"""

import copy
import re
from dataclasses import dataclass, field

FAMILY_SLOTS = ["name", "phone", "who", "service", "town", "payment", "urgency", "callback_time"]
JOB_SLOTS = ["name", "phone", "role", "town"]

QUESTION = {
    "track": "Are you calling about care for someone, or about a job with us?",
    "name": "May I have your name, please?",
    "phone": "What is the best phone number for our team to call you back?",
    "who": "Who needs care, and how are they related to you?",
    "service": "What kind of help are you looking for? For example, home care, NJ DDD services, or the Medicare GUIDE dementia program.",
    "town": "What town and county is the care needed in?",
    "payment": "How would care be paid for? For example, private pay or long-term care insurance, an NJ DDD budget, or Medicare.",
    "urgency": "How soon is care needed?",
    "callback_time": "What is the best time for our team to call you back?",
    "role": "What kind of job are you looking for: caregiver, DSP, or nurse?",
    "job_town": "What town do you live in?",
}

EMERGENCY_LINE = "If this is a medical emergency, please hang up and call 9 1 1 right now."
STILL_THERE = "Are you still there?"

YES_RE = re.compile(r"^\W*(yes|yeah|yep|yup|correct|that'?s (right|correct|it)|right|sure|uh-?huh|mm-?hmm|it is)\b", re.I)
NO_RE = re.compile(r"^\W*(no|nope|not quite|that'?s (wrong|not right|incorrect)|wrong|incorrect)\b", re.I)
JOB_RE = re.compile(r"\b(hiring|a job|jobs|work for you|employment|apply|application|position|looking for work|career|work as)\b", re.I)
CARE_RE = re.compile(
    r"\b(care|caregiver for|help (for|with)|mother|father|mom|dad|son|daughter|parent|wife|husband|grand\w+|aunt|uncle|"
    r"ddd|guide|dementia|medicare|nurse at home|respite|companion|support)\b",
    re.I,
)
NAME_RE = re.compile(r"\b(?i:my name is|my name's|this is|i am|i'm|it's|name is|call me)\s+([A-Z][a-z'\-]+(?:\s+[A-Z][a-z'\-]+)?)")
BARE_NAME_RE = re.compile(r"^\W*([A-Za-z][a-z'\-]+(?:\s+[A-Za-z][a-z'\-]+){0,2})\W*$")
NOT_NAMES = {"Calling", "Looking", "Interested", "Here", "Fine", "Good", "Not", "Just", "The", "For", "Her", "His",
             "My", "Yes", "No", "Okay", "Sure", "Hello", "Hi", "Thanks", "Thank", "She", "He", "It", "We", "They",
             "I", "You", "That", "This", "There", "Well", "So", "Um", "Uh", "Yeah", "Oh", "Personal", "Private",
             "Within", "Week", "Weekday", "Weekdays", "Morning", "Mornings", "Evening", "Evenings", "Afternoon",
             "Companion", "Nursing", "Respite", "Home", "Care", "Medicare", "Insurance", "Soon", "Today", "Tomorrow"}
WHO_RE = re.compile(r"\b(my (mother|mom|father|dad|son|daughter|wife|husband|parents?|grand\w+|aunt|uncle|brother|sister|child|partner|friend|neighbor)|myself|for me\b)", re.I)
PAY_RE = re.compile(r"\b(private(ly)?|out of pocket|insurance|budget|medicaid|medicare|familycare|self[- ]pay|pay (it )?ourselves)\b", re.I)
URGENCY_RE = re.compile(r"\b(asap|as soon as possible|right away|immediately|today|tomorrow|this week|next week|within|soon|urgent|next month|no rush|whenever)\b", re.I)
TIME_RE = re.compile(r"\b(morning|afternoon|evening|after \d|before \d|any ?time|weekdays?|weekends?|noon|lunch|\d\s?(am|pm|a\.m\.|p\.m\.))\b", re.I)
TOWN_RE = re.compile(r"\b(?i:in|from|near|live in|lives in|located in)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})")
COUNTY_RE = re.compile(r"\b(essex|union|middlesex|somerset|morris|hudson|bergen|passaic|monmouth|ocean|mercer|hunterdon|warren|sussex)(\s+county)?\b", re.I)
ROLE_RE = re.compile(r"\b(dsp|direct support|caregiver|chha|home health aide|aide|companion|nurse|rn|lpn)\b", re.I)
GOODBYE_RE = re.compile(r"\b(good ?bye|bye|that'?s all|that is all|i have to go|gotta go|hang up)\b", re.I)
QUESTION_RE = re.compile(
    r"\?|(^|[.!,]\s*)(how|what|what's|does|do|is|are|can|could|who|when|where|will|would|should|why|which)\b[^.!]*$",
    re.I,
)
# Things to hand to the model even without a question mark.
OFF_SCRIPT_RE = re.compile(
    r"\b(robot|human|real person|a person|someone (real|live)|speak (to|with)|talk (to|with)|manager|"
    r"tell me (about|more)|explain|not sure|don'?t know|i'm confused|repeat|say that again)\b",
    re.I,
)


_DIGIT_WORDS = {"zero": "0", "oh": "0", "o": "0", "one": "1", "two": "2", "three": "3", "four": "4",
                "five": "5", "six": "6", "seven": "7", "eight": "8", "nine": "9"}


def raw_digits(text: str) -> str:
    """All digits in speech-to-text output like '973 555 0142' or 'nine seven three ...'."""
    t = re.sub(r"[a-zA-Z]+", lambda m: _DIGIT_WORDS.get(m.group(0).lower(), " "), text)
    return re.sub(r"\D", "", t)


def mostly_digits(text: str) -> bool:
    """True when most words are digits ('nine seven three', '973 555'), not 'within two weeks'."""
    filler = {"it", "its", "s", "is", "my", "number", "the", "and", "uh", "um", "that", "thats", "so",
              "area", "code", "then", "a", "at", "me", "reach", "you", "can", "on", "cell", "phone", "yes"}
    words = [w for w in re.findall(r"[A-Za-z]+|\d+", text) if w.lower() not in filler]
    if not words:
        return False
    numeric = [w for w in words if w.isdigit() or w.lower() in _DIGIT_WORDS]
    return len(numeric) / len(words) >= 0.5


def digits_of(text: str) -> str:
    """A full 10-digit US phone number from the text, or ''."""
    d = raw_digits(text)
    if len(d) == 11 and d.startswith("1"):
        d = d[1:]
    return d if len(d) == 10 else ""


def spaced(d: str) -> str:
    return f"{' '.join(d[:3])}, {' '.join(d[3:6])}, {' '.join(d[6:])}"


@dataclass
class Plan:
    say: str = ""                # spoken right away, no model
    llm_instruction: str = ""    # if set, the model answers first
    then_say: str = ""           # spoken after the model's answer
    end: bool = False            # hang up after speaking


@dataclass
class Checklist:
    track: str = ""  # "family" or "job"
    values: dict = field(default_factory=dict)
    last_asked: str = ""  # the slot the assistant last asked for
    phone_digits: str = ""
    phone_state: str = ""  # "", "readback", "confirmed"
    user_turns: int = 0
    wants_to_end: bool = False
    acks: int = 0
    caller_id: str = ""  # digits of the number the call came from, if known
    partial_digits: str = ""  # a number said across two sentences
    attempts: dict = field(default_factory=dict)  # how many times each slot was asked
    phone_from_caller_id: bool = False
    minimal: bool = False        # no language model available: only name + number
    last_question: str = ""      # the question the assistant just asked
    previous_question: str = ""  # the one before this caller turn (context for the LLM)

    # ---- reading the caller's sentence -----------------------------------
    def _capture(self, t: str) -> str:
        """Store any details in the sentence. Returns the slot the caller answered, if any."""
        answered = ""
        if not self.track:
            if JOB_RE.search(t) and not re.search(r"\bmy (mother|father|mom|dad|son|daughter)\b", t, re.I):
                self.track = "job"
            elif CARE_RE.search(t):
                self.track = "family"
            elif self.last_asked == "track":
                self.track = "job" if re.search(r"\b(job|work)\b", t, re.I) else "family"

        d = digits_of(t)
        if not d and self.last_asked in ("phone", "confirm_phone"):
            # Numbers often arrive in pieces ("973 555" ... "0142").
            rd = raw_digits(t) if mostly_digits(t) else ""
            if rd:
                combined = self.partial_digits + rd
                if len(combined) == 11 and combined.startswith("1"):
                    combined = combined[1:]
                if len(combined) == 10:
                    d = combined
                    self.partial_digits = ""
                elif len(combined) < 10:
                    self.partial_digits = combined
                else:
                    # Too many digits (misheard): start over with the whole number.
                    self.partial_digits = ""
                    self.attempts["partial"] = 3
        if d:
            self.partial_digits = ""
            self.phone_digits, self.phone_state = d, "readback"
            self.values["phone"] = d
            answered = "phone"
        elif self.phone_state == "readback" and self.last_asked == "confirm_phone":
            if YES_RE.search(t):
                self.phone_state = "confirmed"
                answered = "confirm_phone"
            elif NO_RE.search(t):
                self.phone_state, self.phone_digits = "", ""
                self.values.pop("phone", None)
                answered = "confirm_phone"

        m = NAME_RE.search(t)
        if m and "name" not in self.values and m.group(1).split()[0] not in NOT_NAMES:
            self.values["name"] = m.group(1)
        elif self.last_asked == "name" and "name" not in self.values:
            b = BARE_NAME_RE.search(t)
            if b and b.group(1).split()[0].capitalize() not in NOT_NAMES:
                self.values["name"] = b.group(1).title()

        if self.track == "family":
            from .intake import map_service

            m_who = WHO_RE.search(t)
            if m_who and "who" not in self.values:
                age = re.search(r"\b(\d{1,3})( years old|\b)", t)
                self.values["who"] = m_who.group(0) + (f", {age.group(1)}" if age and self.last_asked != "phone" else "")
            if "service" not in self.values and map_service(t) != "Not sure yet":
                self.values["service"] = t
            if PAY_RE.search(t) and "payment" not in self.values and not QUESTION_RE.search(t):
                self.values["payment"] = t
            if URGENCY_RE.search(t) and "urgency" not in self.values and self.last_asked != "callback_time":
                self.values["urgency"] = t
        if self.track == "job" and ROLE_RE.search(t) and "role" not in self.values:
            self.values["role"] = t
        if "town" not in self.values and self.last_asked != "town":
            m_town, m_county = TOWN_RE.search(t), COUNTY_RE.search(t)
            if m_town or m_county:
                town = m_town.group(1) if m_town else ""
                county = m_county.group(0) if m_county else ""
                if town and county and county.split()[0].lower() == town.split()[0].lower():
                    county = ""  # "in Union" names the county once, not twice
                self.values["town"] = " ".join(x for x in (town, county) if x)
        if "callback_time" not in self.values and self.last_asked == "callback_time" and TIME_RE.search(t):
            self.values["callback_time"] = t

        # A plain answer to the question just asked
        slot = self.last_asked
        if slot in self.slots() and slot not in ("phone", "name") and slot not in self.values:
            if not QUESTION_RE.search(t) and not (slot == "name" and len(t.split()) > 6):
                self.values[slot] = t
        if slot and slot in self.values and not answered:
            answered = slot
        return answered

    # ---- deciding the reply --------------------------------------------
    def slots(self) -> list[str]:
        if self.minimal:
            return ["name", "phone"]
        return JOB_SLOTS if self.track == "job" else FAMILY_SLOTS

    def missing(self) -> list[str]:
        return [s for s in self.slots() if s not in self.values]

    def complete(self) -> bool:
        return bool(self.track) and not self.missing() and self.phone_state in ("confirmed", "readback-unanswered")

    def reask(self) -> str:
        """For a turn with no usable words (noise, a cough): repeat the current question."""
        slot, q, end = self._next_question_peek()
        return q if end else f"Sorry, I didn't catch that. {q}"

    def _next_question_peek(self) -> tuple[str, str, bool]:
        snapshot = copy.deepcopy(self.__dict__)
        try:
            return self._next_question()
        finally:
            self.__dict__.update(snapshot)

    def _next_question(self, count: bool = True) -> tuple[str, str, bool]:
        """(slot, sentence, end_call). count=False when re-asking after answering a question."""
        if self.phone_state == "readback" and self.phone_digits:
            self.attempts["confirm_phone"] = self.attempts.get("confirm_phone", 0) + 1
            if self.attempts["confirm_phone"] <= 2:
                return "confirm_phone", f"I have {spaced(self.phone_digits)}. Is that right?", False
            self.phone_state = "readback-unanswered"  # read back twice, no yes or no: move on
        if not self.track and self.minimal:
            self.track = "family"
        if not self.track:
            return "track", QUESTION["track"], False
        if self.wants_to_end or self.user_turns >= 25 or self.complete():
            return "", self.closing_line(), True
        miss = self.missing()
        if not miss:  # everything but the confirmed number
            miss = ["phone"]
            if self.phone_state == "readback-unanswered":
                return "", self.closing_line(), True
        nxt = miss[0]
        if nxt == "phone" and self.attempts.get("partial", 0) >= 3 and not self.partial_digits:
            self.attempts["partial"] = 0
            return "phone", "Sorry, I didn't get the whole number. Could you say all ten digits again, slowly?", False
        if nxt == "phone" and self.partial_digits:
            self.attempts["partial"] = self.attempts.get("partial", 0) + 1
            if self.attempts["partial"] <= 2:
                return "phone", f"I have {' '.join(self.partial_digits)} so far. Please go on.", False
            self.partial_digits, self.attempts["partial"] = "", 0
            return "phone", "Sorry, I didn't get the whole number. Could you say all ten digits again, slowly?", False
        if count:
            self.attempts[nxt] = self.attempts.get(nxt, 0) + 1
        if self.attempts.get(nxt, 0) > 3:
            # Don't loop: move on and let the team fill the gap on the callback.
            if nxt == "phone":
                if self.caller_id:
                    self.phone_digits, self.phone_state = self.caller_id, "confirmed"
                    self.values["phone"] = self.caller_id
                    self.phone_from_caller_id = True
                    return self._next_question_after_skip(
                        "No problem. Our team will call you back at the number you are calling from."
                    )
                self.values["phone"] = ""
                self.phone_state = "confirmed"
            else:
                self.values[nxt] = "(not captured)"
            return self._next_question_after_skip("No problem, our team can go over that on the callback.")
        q = QUESTION["job_town"] if (nxt == "town" and self.track == "job") else QUESTION[nxt]
        if count and self.attempts[nxt] > 1:
            q = "Sorry, I didn't catch that. " + q
        return nxt, q, False

    def _next_question_after_skip(self, prefix: str) -> tuple[str, str, bool]:
        slot, q, end = self._next_question()
        return slot, f"{prefix} {q}", end

    def _ack(self, answered: str, said_no: bool) -> str:
        if said_no:
            return "Sorry about that."
        if answered == "name" and "name" in self.values:
            return f"Thank you, {self.values['name'].split()[0]}."
        if answered in ("", "track") and self.user_turns == 1:
            return "I can help with that."
        self.acks += 1
        return ["Thank you.", "Got it, thank you.", "Okay, thank you."][self.acks % 3]

    def plan(self, text: str, emergency: bool = False) -> Plan:
        self.user_turns += 1
        self.previous_question = self.last_question
        t = (text or "").strip()
        if GOODBYE_RE.search(t):
            self.wants_to_end = True
        was_readback = self.phone_state == "readback" and self.last_asked == "confirm_phone"
        answered = self._capture(t)
        said_no = was_readback and self.phone_state == ""
        if said_no:
            self.attempts["phone"] = 0
        asked_something = bool(QUESTION_RE.search(t)) or bool(OFF_SCRIPT_RE.search(t))
        slot, q, end = self._next_question(count=not (asked_something and not answered))
        self.last_question = q

        if emergency:
            self.last_asked = slot
            return Plan(say=f"{EMERGENCY_LINE} Otherwise, I can take a message. {q}" if not end else EMERGENCY_LINE, end=end)

        if asked_something and not (answered and slot == "confirm_phone"):
            self.last_asked = slot
            return Plan(
                llm_instruction=(
                    "Reply to the caller in one or two short sentences, using only the fact sheet. "
                    "Do not ask any question; the next question is asked for you. Never quote prices, "
                    "promise a start date, or say whether someone qualifies; if you don't know, say the "
                    "team will cover it on the callback."
                ),
                then_say=q,
                end=end,
            )
        self.last_asked = slot
        if end:
            return Plan(say=q, end=True)
        if q.startswith(("Sorry", "No problem", "I have")) and not said_no:
            return Plan(say=q)
        return Plan(say=f"{self._ack(answered, said_no)} {q}")

    def closing_line(self) -> str:
        parts = []
        if self.track == "job":
            parts.append("You can also see open positions and apply on the Careers page at tinashhomecareservices.com.")
        if self.phone_digits:
            when = " at the time you asked for" if self.values.get("callback_time") not in (None, "", "(not captured)") else ""
            parts.append(f"Someone from our team will call you back at {spaced(self.phone_digits)}{when}.")
        elif self.caller_id:
            parts.append("Someone from our team will call you back at the number you are calling from.")
        else:
            parts.append("Someone from our team will call you back.")
        parts.append("Thanks so much for calling Tinash Homecare Services. Take care, goodbye.")
        return " ".join(parts)

    def summary(self) -> dict:
        return {"track": self.track, "phone_confirmed": self.phone_state == "confirmed", **self.values}
