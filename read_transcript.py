import json

file_path = r"C:\Users\WELCOME\.gemini\antigravity-ide\brain\2eb4b790-ef8e-4bf2-a4fd-5683a9fe87cd\.system_generated\logs\transcript.jsonl"

with open(file_path, "r", encoding="utf-8") as f:
    for line in f:
        data = json.loads(line)
        if data.get("step_index") == 68:
            with open("step_68.txt", "w", encoding="utf-8") as out:
                out.write(data.get("content"))
            print("Wrote to step_68.txt")
            break
