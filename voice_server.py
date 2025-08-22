import asyncio
import websockets
import speech_recognition as sr
import json
import signal

recognizer = sr.Recognizer()

# The 'path' argument has been removed from the function definition below
async def transcribe_handler(websocket):
    print("Connection established for voice transcription.")
    try:
        async for audio_chunk in websocket:
            try:
                # Assuming audio is sent as 16-bit PCM at 16000Hz
                audio_data = sr.AudioData(audio_chunk, sample_rate=16000, sample_width=2)
                text = recognizer.recognize_google(audio_data)
                print(f"Recognized: {text}")
                await websocket.send(json.dumps({"transcript": text}))
            except sr.UnknownValueError:
                print("Could not understand audio.")
            except sr.RequestError as e:
                print(f"Google API Error: {e}")
    except websockets.exceptions.ConnectionClosed:
        print("Connection for voice transcription closed.")

async def main():
    # Set the stop condition when receiving SIGTERM.
    loop = asyncio.get_running_loop()
    stop = loop.create_future()
    loop.add_signal_handler(signal.SIGTERM, stop.set_result, None)

    async with websockets.serve(transcribe_handler, "localhost", 8765):
        print("🚀 Python Voice Service is running on ws://localhost:8765")
        await asyncio.Future()  # This will run forever until cancelled

if __name__ == "__main__":
    asyncio.run(main())