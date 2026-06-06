import os
os.chdir('/sandbox/.openclaw/workspace/firstlight')
with open('src/components/marketing/app-screenshot.tsx', 'r') as f:
    content = f.read()
content = content.replace(
    'light: "/screenshots/app-sift.png",
    dark: null,',
    'light: "/screenshots/app-sift.png",
    dark: "/screenshots/app-sift-dark.png",'
)
with open('src/components/marketing/app-screenshot.tsx', 'w') as f:
    f.write(content)
print("Done")
