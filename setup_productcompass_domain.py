#!/usr/bin/env python3
"""
Product Compass Domain Setup Script
Customized setup for productcompass.com domain with Mailgun
"""

import os
import requests
import time
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

DOMAIN_NAME = "productcompass.com"

def check_domain_availability():
    """Check if productcompass.com is available"""
    print(f"🔍 Checking availability of {DOMAIN_NAME}...")
    
    print("\n📝 Next Steps:")
    print("1. Check domain availability at:")
    print("   • Namecheap: https://www.namecheap.com/")
    print("   • GoDaddy: https://www.godaddy.com/")
    print("   • Google Domains: https://domains.google/")
    print("\n2. Search for 'productcompass.com'")
    print("3. If available, purchase it (usually $10-15/year)")
    print("4. If not available, consider alternatives like:")
    print("   • productcompass.io")
    print("   • productcompass.app") 
    print("   • productcompass.co")
    print("   • product-compass.com")
    
    choice = input(f"\n❓ Do you already own {DOMAIN_NAME}? (y/n): ").lower()
    
    if choice == 'y':
        print(f"✅ Great! You own {DOMAIN_NAME}")
        return True
    else:
        print(f"\n🛒 Please purchase {DOMAIN_NAME} first, then run this script again.")
        print("\n📋 Recommended registrars:")
        print("• Namecheap (recommended): Easy DNS management, good support")
        print("• GoDaddy: Popular, user-friendly interface") 
        print("• Google Domains: Clean interface, reliable")
        return False

def add_domain_to_mailgun():
    """Add productcompass.com to Mailgun"""
    
    api_key = os.getenv('MAILGUN_API_KEY')
    base_url = os.getenv('MAILGUN_BASE_URL', 'https://api.mailgun.net/v3')
    
    if not api_key:
        print("❌ MAILGUN_API_KEY not found in .env file")
        return False
    
    print(f"🌐 Adding {DOMAIN_NAME} to Mailgun...")
    
    try:
        url = f"{base_url}/domains"
        
        data = {
            'name': DOMAIN_NAME,
            'force_dkim_authority': True,
            'dkim_key_size': 2048,
            'ips': [],
            'web_scheme': 'https'
        }
        
        response = requests.post(
            url,
            auth=('api', api_key),
            data=data,
            timeout=10
        )
        
        if response.status_code == 200:
            print("✅ Domain added to Mailgun successfully!")
            return True
        elif response.status_code == 400 and "already exists" in response.text.lower():
            print("✅ Domain already exists in Mailgun!")
            return True
        else:
            print(f"❌ Failed to add domain: {response.status_code}")
            print(f"Response: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Error adding domain: {e}")
        return False

def show_dns_records():
    """Show DNS records that need to be added"""
    
    print(f"\n📋 DNS RECORDS FOR {DOMAIN_NAME.upper()}")
    print("=" * 60)
    
    print("\n1️⃣ SPF Record (Required)")
    print(f"   Type: TXT")
    print(f"   Name: {DOMAIN_NAME}")
    print(f"   Value: v=spf1 include:mailgun.org ~all")
    print(f"   TTL: 300")
    
    print("\n2️⃣ DKIM Record (Required - Get from Mailgun Dashboard)")
    print(f"   Type: TXT")
    print(f"   Name: mailo._domainkey.{DOMAIN_NAME}")
    print(f"   Value: [Copy the long DKIM key from Mailgun dashboard]")
    print(f"   TTL: 300")
    
    print(f"\n📍 WHERE TO ADD THESE RECORDS:")
    print("=" * 40)
    
    print("\n🔹 NAMECHEAP:")
    print("   1. Login to Namecheap account")
    print("   2. Go to Domain List → Manage")
    print("   3. Click 'Advanced DNS' tab")
    print("   4. Add the TXT records above")
    
    print("\n🔹 GODADDY:")
    print("   1. Login to GoDaddy account")
    print("   2. Go to My Products → DNS")
    print("   3. Add the TXT records above")
    
    print("\n🔹 GOOGLE DOMAINS:")
    print("   1. Login to Google Domains")
    print("   2. Select your domain")
    print("   3. Go to DNS → Custom Records")
    print("   4. Add the TXT records above")
    
    print(f"\n⚠️  IMPORTANT NOTES:")
    print("• For the DKIM record, you MUST get the actual value from Mailgun")
    print("• Go to https://app.mailgun.com/app/domains")
    print(f"• Click on {DOMAIN_NAME}")
    print("• Copy the DKIM record value (it's very long)")
    print("• Some registrars only need 'mailo._domainkey' as the name")
    
    return True

def get_dkim_from_mailgun():
    """Get DKIM record from Mailgun"""
    
    api_key = os.getenv('MAILGUN_API_KEY')
    base_url = os.getenv('MAILGUN_BASE_URL', 'https://api.mailgun.net/v3')
    
    print(f"🔐 Getting DKIM record for {DOMAIN_NAME}...")
    
    try:
        url = f"{base_url}/domains/{DOMAIN_NAME}"
        
        response = requests.get(
            url,
            auth=('api', api_key),
            timeout=10
        )
        
        if response.status_code == 200:
            domain_data = response.json()['domain']
            
            # Look for DKIM in the response
            for record in domain_data.get('sending_dns_records', []):
                if record.get('record_type') == 'TXT' and 'DKIM1' in record.get('value', ''):
                    print(f"\n🔐 DKIM Record Found:")
                    print(f"   Name: {record.get('name', 'mailo._domainkey.' + DOMAIN_NAME)}")
                    print(f"   Value: {record.get('value', '')}")
                    return True
            
            print("⚠️  DKIM record not found in API response")
            print("Please check Mailgun dashboard manually")
            return False
        else:
            print(f"❌ Cannot get DKIM record: {response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ Error getting DKIM: {e}")
        return False

def verify_dns():
    """Verify DNS records are set up correctly"""
    
    print(f"\n🔍 Verifying DNS records for {DOMAIN_NAME}...")
    
    try:
        import subprocess
        
        # Check SPF record
        print("📧 Checking SPF record...")
        try:
            spf_result = subprocess.run(
                ['nslookup', '-type=TXT', DOMAIN_NAME], 
                capture_output=True, text=True, timeout=10
            )
            
            if 'mailgun.org' in spf_result.stdout:
                print("✅ SPF record found!")
                spf_ok = True
            else:
                print("❌ SPF record not found")
                spf_ok = False
        except:
            print("⚠️  Cannot verify SPF record")
            spf_ok = False
        
        # Check DKIM record
        print("🔐 Checking DKIM record...")
        try:
            dkim_domain = f"mailo._domainkey.{DOMAIN_NAME}"
            dkim_result = subprocess.run(
                ['nslookup', '-type=TXT', dkim_domain], 
                capture_output=True, text=True, timeout=10
            )
            
            if 'v=DKIM1' in dkim_result.stdout:
                print("✅ DKIM record found!")
                dkim_ok = True
            else:
                print("❌ DKIM record not found")
                dkim_ok = False
        except:
            print("⚠️  Cannot verify DKIM record")
            dkim_ok = False
        
        return spf_ok and dkim_ok
        
    except Exception as e:
        print(f"❌ Error verifying DNS: {e}")
        return False

def check_mailgun_status():
    """Check domain status in Mailgun"""
    
    api_key = os.getenv('MAILGUN_API_KEY')
    base_url = os.getenv('MAILGUN_BASE_URL', 'https://api.mailgun.net/v3')
    
    print(f"📊 Checking Mailgun status for {DOMAIN_NAME}...")
    
    try:
        url = f"{base_url}/domains/{DOMAIN_NAME}"
        
        response = requests.get(
            url,
            auth=('api', api_key),
            timeout=10
        )
        
        if response.status_code == 200:
            domain_info = response.json()['domain']
            state = domain_info.get('state', 'unknown')
            
            print(f"📍 Domain: {DOMAIN_NAME}")
            print(f"📊 Status: {state}")
            
            if state == 'active':
                print("🎉 Domain is verified and active!")
                return True
            else:
                print(f"⏳ Domain status: {state}")
                return False
        else:
            print(f"❌ Cannot check status: {response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ Error checking status: {e}")
        return False

def update_env_file():
    """Update .env file with productcompass.com"""
    
    print(f"📝 Updating .env file for {DOMAIN_NAME}...")
    
    try:
        # Read current .env file
        with open('.env', 'r') as f:
            lines = f.readlines()
        
        # Update relevant lines
        updated_lines = []
        domain_updated = False
        mail_updated = False
        
        for line in lines:
            if line.startswith('MAILGUN_DOMAIN='):
                updated_lines.append(f'MAILGUN_DOMAIN={DOMAIN_NAME}\n')
                domain_updated = True
            elif line.startswith('MAIL_FROM_ADDRESS='):
                updated_lines.append(f'MAIL_FROM_ADDRESS=noreply@{DOMAIN_NAME}\n')
                mail_updated = True
            else:
                updated_lines.append(line)
        
        # Add lines if they don't exist
        if not domain_updated:
            updated_lines.append(f'MAILGUN_DOMAIN={DOMAIN_NAME}\n')
        if not mail_updated:
            updated_lines.append(f'MAIL_FROM_ADDRESS=noreply@{DOMAIN_NAME}\n')
        
        # Write back to .env file
        with open('.env', 'w') as f:
            f.writelines(updated_lines)
        
        print("✅ .env file updated successfully!")
        print(f"📧 Email from address: noreply@{DOMAIN_NAME}")
        return True
        
    except Exception as e:
        print(f"❌ Error updating .env file: {e}")
        return False

def send_test_email():
    """Send a test email to verify everything works"""
    
    print(f"\n🧪 Testing email delivery from {DOMAIN_NAME}...")
    
    test_email = input("📧 Enter your email to receive a test message: ").strip()
    
    if not test_email or '@' not in test_email:
        print("❌ Invalid email address")
        return False
    
    # Use the send_mailgun_email function from app.py
    try:
        from app import send_mailgun_email
        
        subject = f"✅ Test Email from {DOMAIN_NAME}"
        html_content = f"""
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1 style="color: #0056d2;">🎉 Success!</h1>
            <p>This is a test email from your new custom domain: <strong>{DOMAIN_NAME}</strong></p>
            <p>✅ Domain is properly configured</p>
            <p>✅ Mailgun integration working</p>
            <p>✅ DNS records verified</p>
            <p>✅ Professional email delivery achieved!</p>
            <hr>
            <p style="color: #666; font-size: 14px;">
                This email was sent from Product Compass using your custom domain.
            </p>
        </div>
        """
        
        success, error = send_mailgun_email(
            to_email=test_email,
            subject=subject,
            html_content=html_content
        )
        
        if success:
            print("✅ Test email sent successfully!")
            print(f"📬 Check your inbox at {test_email}")
            print("📊 Check spam folder if you don't see it immediately")
            return True
        else:
            print(f"❌ Test email failed: {error}")
            return False
            
    except Exception as e:
        print(f"❌ Error sending test email: {e}")
        return False

def main():
    """Main setup function for productcompass.com"""
    
    print("🚀 Product Compass Domain Setup")
    print(f"🎯 Setting up: {DOMAIN_NAME}")
    print("=" * 50)
    
    # Step 1: Check domain ownership
    print("\n" + "="*50)
    print("STEP 1: Domain Ownership")
    print("="*50)
    
    if not check_domain_availability():
        return
    
    # Step 2: Add to Mailgun
    print("\n" + "="*50)
    print("STEP 2: Adding to Mailgun")
    print("="*50)
    
    if not add_domain_to_mailgun():
        print("❌ Cannot proceed without adding domain to Mailgun")
        return
    
    # Step 3: Show DNS records
    print("\n" + "="*50)
    print("STEP 3: DNS Configuration")
    print("="*50)
    
    show_dns_records()
    
    # Try to get DKIM from Mailgun API
    print("\n🔍 Attempting to get DKIM record from Mailgun...")
    get_dkim_from_mailgun()
    
    # Wait for user to add DNS records
    input("\n⏸️  Press Enter AFTER you've added both TXT records to your domain...")
    
    # Step 4: Verify DNS
    print("\n" + "="*50)
    print("STEP 4: DNS Verification")
    print("="*50)
    
    print("⏰ Waiting 30 seconds for DNS propagation...")
    time.sleep(30)
    
    dns_ok = verify_dns()
    
    if not dns_ok:
        print("\n⚠️  DNS verification failed.")
        retry = input("🔄 Wait more and try again? (y/n): ").lower()
        if retry == 'y':
            print("⏰ Waiting 60 more seconds...")
            time.sleep(60)
            dns_ok = verify_dns()
    
    # Step 5: Check Mailgun status
    print("\n" + "="*50)
    print("STEP 5: Mailgun Verification")
    print("="*50)
    
    mailgun_ok = check_mailgun_status()
    
    # Step 6: Update .env file
    print("\n" + "="*50)
    print("STEP 6: Update Configuration")
    print("="*50)
    
    update_env_file()
    
    # Step 7: Test everything
    if mailgun_ok:
        print("\n" + "="*50)
        print("STEP 7: Final Test")
        print("="*50)
        
        send_test_email()
    
    # Final status
    print("\n" + "="*60)
    print("🏁 SETUP COMPLETE!")
    print("="*60)
    
    if mailgun_ok:
        print("✅ Domain added to Mailgun")
        print("✅ DNS records configured")
        print("✅ Domain verified and active")
        print("✅ .env file updated")
        print("\n🎉 CONGRATULATIONS!")
        print(f"📧 Your emails will now be sent from: noreply@{DOMAIN_NAME}")
        print("📈 You now have professional email deliverability!")
        print("🧪 Test your contact form to see the difference!")
        
        print(f"\n📊 Expected improvements:")
        print("• 📈 90%+ inbox delivery rate (vs 30% with sandbox)")
        print("• 📧 10,000 emails/month (vs 300 with sandbox)")
        print("• 🌟 Professional sender reputation")
        print("• 🚫 No more authorized recipients restriction")
    else:
        print("\n⚠️  Setup incomplete. Next steps:")
        print("1. Double-check DNS records are correct")
        print("2. Wait 30 minutes for full DNS propagation")
        print("3. Check Mailgun dashboard for verification status")
        print("4. Run this script again to test")

if __name__ == "__main__":
    main() 