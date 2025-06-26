#!/usr/bin/env python3
"""
Mailgun Email Test Script
Test your Mailgun configuration before using the contact form.
"""

import os
import requests
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

def test_mailgun_config():
    """Test Mailgun configuration"""
    
    api_key = os.getenv('MAILGUN_API_KEY')
    domain = os.getenv('MAILGUN_DOMAIN')
    base_url = os.getenv('MAILGUN_BASE_URL', 'https://api.mailgun.net/v3')
    from_address = os.getenv('MAIL_FROM_ADDRESS')
    from_name = os.getenv('MAIL_FROM_NAME', 'Product Compass')
    contact_email = os.getenv('CONTACT_EMAIL')
    
    print("🚀 Mailgun Configuration Test")
    print("=" * 40)
    print(f"📧 API Key: {'✅ Set' if api_key else '❌ Missing'}")
    print(f"🌐 Domain: {domain if domain else '❌ Missing'}")
    print(f"📍 Base URL: {base_url}")
    print(f"📤 From Address: {from_address if from_address else '❌ Missing'}")
    print(f"👤 From Name: {from_name}")
    print(f"📬 Contact Email: {contact_email if contact_email else '❌ Missing'}")
    print()
    
    # Check required fields
    if not api_key or not domain or not from_address or not contact_email:
        print("❌ Missing required configuration!")
        print("\n🔧 Please update your .env file with:")
        if not api_key:
            print("   MAILGUN_API_KEY=your-mailgun-api-key")
        if not domain:
            print("   MAILGUN_DOMAIN=your-domain.mailgun.org")
        if not from_address:
            print("   MAIL_FROM_ADDRESS=noreply@your-domain.mailgun.org")
        if not contact_email:
            print("   CONTACT_EMAIL=your-email@example.com")
        return False
    
    return True

def send_test_email():
    """Send a test email via Mailgun"""
    
    api_key = os.getenv('MAILGUN_API_KEY')
    domain = os.getenv('MAILGUN_DOMAIN')
    base_url = os.getenv('MAILGUN_BASE_URL', 'https://api.mailgun.net/v3')
    from_address = os.getenv('MAIL_FROM_ADDRESS')
    from_name = os.getenv('MAIL_FROM_NAME', 'Product Compass')
    contact_email = os.getenv('CONTACT_EMAIL')
    
    print("📧 Sending test email...")
    
    try:
        url = f"{base_url}/{domain}/messages"
        
        # Test email content
        html_content = """
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #0056d2, #4f46e5); color: white; padding: 2rem; text-align: center; border-radius: 8px;">
                <h1 style="margin: 0;">🎉 Mailgun Test Successful!</h1>
                <p style="margin: 10px 0 0 0; opacity: 0.9;">Your contact form is ready to use</p>
            </div>
            <div style="padding: 2rem; background: #f8f9fa; border-radius: 0 0 8px 8px;">
                <p style="color: #333; margin: 0;">
                    Congratulations! Your Mailgun configuration is working perfectly. 
                    Your contact form is now ready to send emails! 🚀
                </p>
            </div>
        </div>
        """
        
        text_content = """
        🎉 Mailgun Test Successful!
        
        Congratulations! Your Mailgun configuration is working perfectly.
        Your contact form is now ready to send emails!
        """
        
        data = {
            'from': f"{from_name} <{from_address}>",
            'to': contact_email,
            'subject': '🧪 Mailgun Test - Success!',
            'html': html_content,
            'text': text_content
        }
        
        response = requests.post(
            url,
            auth=('api', api_key),
            data=data,
            timeout=10
        )
        
        if response.status_code == 200:
            result = response.json()
            print("✅ Test email sent successfully!")
            print(f"📧 Message ID: {result.get('id', 'N/A')}")
            print(f"📬 Check your inbox at {contact_email}")
            return True
        else:
            print(f"❌ Failed to send email!")
            print(f"   Status Code: {response.status_code}")
            print(f"   Response: {response.text}")
            return False
            
    except requests.exceptions.Timeout:
        print("❌ Request timed out!")
        print("   Check your internet connection and try again.")
        return False
        
    except requests.exceptions.RequestException as e:
        print(f"❌ Request failed: {e}")
        return False
        
    except Exception as e:
        print(f"❌ Unexpected error: {e}")
        return False

def test_domain_verification():
    """Test if domain is verified"""
    
    api_key = os.getenv('MAILGUN_API_KEY')
    domain = os.getenv('MAILGUN_DOMAIN')
    base_url = os.getenv('MAILGUN_BASE_URL', 'https://api.mailgun.net/v3')
    
    print("🔍 Checking domain verification...")
    
    try:
        url = f"{base_url}/domains/{domain}"
        
        response = requests.get(
            url,
            auth=('api', api_key),
            timeout=10
        )
        
        if response.status_code == 200:
            domain_info = response.json()
            domain_data = domain_info.get('domain', {})
            
            state = domain_data.get('state', 'unknown')
            print(f"📍 Domain: {domain}")
            print(f"🔐 Status: {state}")
            
            if state == 'active':
                print("✅ Domain is verified and active!")
                return True
            else:
                print("⚠️  Domain needs verification!")
                print("   Please check your Mailgun dashboard and verify your domain.")
                return False
        else:
            print(f"❌ Cannot check domain status!")
            print(f"   Status Code: {response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ Error checking domain: {e}")
        return False

if __name__ == "__main__":
    print("🚀 Product Compass - Mailgun Test")
    print("=" * 50)
    
    # Step 1: Test configuration
    if not test_mailgun_config():
        exit(1)
    
    print("✅ Configuration looks good!")
    print()
    
    # Step 2: Test domain verification
    domain_ok = test_domain_verification()
    print()
    
    # Step 3: Send test email
    if domain_ok:
        success = send_test_email()
        
        if success:
            print("\n🎉 Mailgun is working perfectly!")
            print("Your contact form is ready to use.")
        else:
            print("\n❌ Email sending failed.")
            print("Please check your Mailgun configuration.")
    else:
        print("⚠️  Skipping email test due to domain verification issues.")
        print("Please verify your domain in the Mailgun dashboard first.") 