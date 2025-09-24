#!/usr/bin/env python3
"""
System Test Script for Azure AI Chat NPS Assistant
Tests end-to-end functionality, latency, and accuracy requirements from PRD v8
"""

import time
import requests
import json
import asyncio
import websockets
from concurrent.futures import ThreadPoolExecutor
import statistics
import sys
import os

# Add backend to path
sys.path.append(os.path.join(os.path.dirname(__file__), 'backend'))

def test_health_endpoint():
    """Test the /health endpoint"""
    try:
        response = requests.get('http://localhost:8000/health', timeout=5)
        if response.status_code == 200:
            print("✅ Health endpoint working")
            return True
        else:
            print(f"❌ Health endpoint failed: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Health endpoint error: {e}")
        return False

def test_predict_endpoint():
    """Test the /predict endpoint with various inputs"""
    test_cases = [
        ("I'm very upset with this service", 0.8),  # Expected high detractor risk
        ("Thanks for the great help!", 0.2),        # Expected low detractor risk
        ("This is terrible, I want a refund", 0.9), # Expected very high detractor risk
        ("Perfect service, highly recommend", 0.1),  # Expected very low detractor risk
    ]
    
    results = []
    latencies = []
    
    for text, expected_risk in test_cases:
        try:
            start_time = time.time()
            response = requests.post(
                'http://localhost:8000/predict',
                json={'transcript': text},
                headers={'Content-Type': 'application/json'},
                timeout=5
            )
            end_time = time.time()
            
            latency = end_time - start_time
            latencies.append(latency)
            
            if response.status_code == 200:
                data = response.json()
                actual_risk = data.get('prob_detractor', 0)
                accuracy = 1 - abs(actual_risk - expected_risk)
                results.append(accuracy)
                print(f"✅ Predict: '{text[:30]}...' -> Risk: {actual_risk:.2f}, Latency: {latency:.3f}s")
            else:
                print(f"❌ Predict failed: {response.status_code}")
                return False
                
        except Exception as e:
            print(f"❌ Predict error: {e}")
            return False
    
    avg_accuracy = statistics.mean(results)
    avg_latency = statistics.mean(latencies)
    max_latency = max(latencies)
    
    print(f"📊 Prediction Accuracy: {avg_accuracy:.2f} (Target: >0.85)")
    print(f"📊 Average Latency: {avg_latency:.3f}s (Target: <2s)")
    print(f"📊 Max Latency: {max_latency:.3f}s")
    
    return avg_accuracy > 0.85 and max_latency < 2.0

async def test_websocket_chat():
    """Test WebSocket chat functionality"""
    try:
        uri = "ws://localhost:8000/ws/chat?sessionId=test-session"
        async with websockets.connect(uri) as websocket:
            # Send a customer message
            message = {
                "sender": "customer",
                "content": "I'm frustrated with this broken product!"
            }
            await websocket.send(json.dumps(message))
            
            # Wait for response
            response = await asyncio.wait_for(websocket.recv(), timeout=5)
            data = json.loads(response)
            
            if data.get('type') == 'message':
                print("✅ WebSocket chat working")
                return True
            else:
                print(f"❌ Unexpected WebSocket response: {data}")
                return False
                
    except Exception as e:
        print(f"❌ WebSocket error: {e}")
        return False

def test_concurrent_sessions(num_sessions=20):
    """Test concurrent session handling"""
    def make_request(session_id):
        try:
            response = requests.post(
                'http://localhost:8000/predict',
                json={'transcript': f'Test message from session {session_id}'},
                headers={'Content-Type': 'application/json'},
                timeout=10
            )
            return response.status_code == 200
        except:
            return False
    
    print(f"🔄 Testing {num_sessions} concurrent sessions...")
    
    with ThreadPoolExecutor(max_workers=num_sessions) as executor:
        futures = [executor.submit(make_request, i) for i in range(num_sessions)]
        results = [future.result() for future in futures]
    
    success_rate = sum(results) / len(results)
    print(f"📊 Concurrent Sessions Success Rate: {success_rate:.2f} ({sum(results)}/{len(results)})")
    
    return success_rate >= 0.8  # Allow 20% failure rate for concurrent testing

def main():
    """Run all tests"""
    print("🚀 Starting Azure AI Chat NPS Assistant System Tests")
    print("=" * 60)
    
    tests = [
        ("Health Endpoint", test_health_endpoint),
        ("Predict Endpoint", test_predict_endpoint),
        ("Concurrent Sessions", lambda: test_concurrent_sessions(20)),
    ]
    
    results = []
    
    for test_name, test_func in tests:
        print(f"\n🧪 Testing {test_name}...")
        try:
            if asyncio.iscoroutinefunction(test_func):
                result = asyncio.run(test_func())
            else:
                result = test_func()
            results.append((test_name, result))
        except Exception as e:
            print(f"❌ {test_name} failed with exception: {e}")
            results.append((test_name, False))
    
    print("\n" + "=" * 60)
    print("📋 TEST RESULTS SUMMARY")
    print("=" * 60)
    
    passed = 0
    for test_name, result in results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status} {test_name}")
        if result:
            passed += 1
    
    print(f"\n🎯 Overall: {passed}/{len(results)} tests passed")
    
    if passed == len(results):
        print("🎉 All tests passed! System meets PRD v8 requirements.")
        return True
    else:
        print("⚠️  Some tests failed. System may not meet all requirements.")
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)