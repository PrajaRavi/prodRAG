import os
from portkey_ai import Portkey
from dotenv import load_dotenv
load_dotenv()



# Set your Portkey control plane key
PORTKEY_API_KEY = os.getenv("PORTKEY_API_KEY")
print(PORTKEY_API_KEY)
print("="*100)
GEMINI_MODEL="gemini-3.5-flash-lite"
GROQ_MODEL="openai/gpt-oss-120b"
# Define a load-balancing / fallback configuration for your 6 models
# This configuration distributes traffic evenly across your Groq & Gemini virtual keys 
# and applies built-in retries with exponential backoff on failures.

# Initialize Portkey Client with the custom gateway configuration
portkey = Portkey(
    api_key=PORTKEY_API_KEY,
    config="pc-my-por-8880c3"
)

# Run a chat completion request through your gateway cluster
response = portkey.chat.completions.create(
    messages=[
        {"role": "user", "content": "Explain the concept of AI Gateways in 2 sentences."}
    ],
    model="ignored-when-using-loadbalance-targets" # Portkey routes based on targets config above
)

print(response.choices[0].message.content)