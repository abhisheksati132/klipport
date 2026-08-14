import re

filepath = 'c:/Users/abhis/klipport/client/src/pages/Dashboard.jsx'

with open(filepath, 'r', encoding='utf-8') as f:
    code = f.read()

# Replace modal primary buttons
code = re.sub(
    r'<button\s+type="submit"[^>]*className="w-full rounded-xl bg-brand-600 py-3 text-sm font-semibold text-white transition-all hover:bg-brand-500 flex items-center justify-center gap-2 cursor-pointer"[^>]*>',
    r'<button type="submit" className="a-btn w-full py-3">',
    code
)

# Replace other primary buttons
code = re.sub(
    r'className="w-full rounded-xl bg-brand-600 py-3 text-sm font-semibold text-white transition-all hover:bg-brand-500 flex items-center justify-center gap-2 cursor-pointer"',
    r'className="a-btn w-full py-3"',
    code
)

# Replace ghost buttons
code = re.sub(
    r'className="w-full rounded-xl bg-white/5 border border-white/10 py-3 text-sm font-semibold text-white transition-all hover:bg-white/10 cursor-pointer"',
    r'className="a-btn a-btn-ghost w-full py-3"',
    code
)
code = re.sub(
    r'className="mt-6 w-full rounded-xl bg-white/5 border border-white/10 py-2.5 text-sm font-semibold text-white hover:bg-white/10 transition-all cursor-pointer"',
    r'className="a-btn a-btn-ghost w-full py-3 mt-6"',
    code
)
code = re.sub(
    r'className="mt-5 w-full rounded-xl bg-white/5 border border-white/10 py-2.5 text-sm font-semibold text-white hover:bg-white/10 transition-all cursor-pointer"',
    r'className="a-btn a-btn-ghost w-full py-3 mt-5"',
    code
)

# Replace modal inputs
code = re.sub(
    r'className="w-full rounded-xl border border-white/10 bg-white/\[0\.02\] py-2\.5 px-4 text-sm text-white placeholder-gray-500 outline-none transition-all focus:border-brand-500/30"',
    r'className="a-input"',
    code
)

code = re.sub(
    r'className="w-full rounded-xl border border-white/10 bg-white/\[0\.02\] py-2\.5 pl-11 pr-10 text-sm text-white placeholder-gray-500 outline-none transition-all focus:border-brand-500/30"',
    r'className="a-input pl-11 pr-10"',
    code
)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(code)

print("Modal buttons and inputs updated.")
