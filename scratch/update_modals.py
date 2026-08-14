import re

filepath = 'c:/Users/abhis/klipport/client/src/pages/Dashboard.jsx'

with open(filepath, 'r', encoding='utf-8') as f:
    code = f.read()

# Replace modal overlays
code = re.sub(
    r'<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm[^"]*">',
    '<div className="a-modal-overlay">',
    code
)

# Replace modal panels
code = re.sub(
    r'<div className="w-full (max-w-[a-z]+) rounded-2xl border border-white/5 bg-dark-card p-6 shadow-2xl relative[^"]*">',
    r'<div className="a-modal-panel w-full \1">',
    code
)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(code)

print("Modal classes updated.")
