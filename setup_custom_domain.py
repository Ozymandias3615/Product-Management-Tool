#!/usr/bin/env python3
"""
Custom Domain Setup Helper for Mailgun
This script helps you set up a custom domain for better email deliverability.
"""

import os
import requests
import time
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

def add_domain_to_mailgun(domain_name):
    """Add a new domain to Mailgun"""
    
    api_key = os.getenv('MAILGUN_API_KEY')
    base_url = os.getenv('MAILGUN_BASE_URL', 'https://api.mailgun.net/v3')
    
    print(f"🌐 Adding domain '{domain_name}' to Mailgun...")
    
    try:
        url = f"{base_url}/domains"
        
        data = {
            'name': domain_name,
            'force_dkim_authority': True,  # Use Mailgun's DKIM
            'dkim_key_size': 2048,        # Strong encryption
            'ips': [],                    # Use shared IPs (free tier)
            'web_scheme': 'https'         # Use HTTPS
        }
        
        response = requests.post(
            url,
            auth=('api', api_key),
            data=data,
            timeout=10
        )
        
        if response.status_code == 200:
            domain_info = response.json()
            print("✅ Domain added successfully!")
            return domain_info
        else:
            print(f"❌ Failed to add domain: {response.status_code}")
            print(f"Response: {response.text}")
            return None
            
    except Exception as e:
        print(f"❌ Error adding domain: {e}")
        return None

def get_dns_records(domain_name):
    """Get DNS records for domain verification"""
    
    api_key = os.getenv('MAILGUN_API_KEY')
    base_url = os.getenv('MAILGUN_BASE_URL', 'https://api.mailgun.net/v3')
    
    print(f"📋 Getting DNS records for '{domain_name}'...")
    
    try:
        url = f"{base_url}/domains/{domain_name}"
        
        response = requests.get(
            url,
            auth=('api', api_key),
            timeout=10
        )
        
        if response.status_code == 200:
            domain_data = response.json()['domain']
            
            print("\n📋 DNS RECORDS TO ADD TO YOUR DOMAIN:")
            print("=" * 60)
            
            # SPF Record
            print("\n1️⃣ SPF Record (Sender Policy Framework)")
            print(f"   Type: TXT")
            print(f"   Name: {domain_name}")
            print(f"   Value: v=spf1 include:mailgun.org ~all")
            print(f"   TTL: 300")
            
            # DKIM Record  
            print("\n2️⃣ DKIM Record (Domain Keys Identified Mail)")
            print(f"   Type: TXT")
            print(f"   Name: mailo._domainkey.{domain_name}")
            print(f"   Value: [Will be provided by Mailgun - check dashboard]")
            print(f"   TTL: 300")
            
            # MX Record (optional for receiving)
            print(f"\n3️⃣ MX Record (if you want to receive emails)")
            print(f"   Type: MX")
            print(f"   Name: {domain_name}")
            print(f"   Value: mxa.mailgun.org")
            print(f"   Priority: 10")
            print(f"   TTL: 300")
            
            # CNAME for tracking (optional)
            print(f"\n4️⃣ CNAME Record (for email tracking)")
            print(f"   Type: CNAME")
            print(f"   Name: email.{domain_name}")
            print(f"   Value: mailgun.org")
            print(f"   TTL: 300")
            
            print("\n" + "=" * 60)
            print("📝 INSTRUCTIONS:")
            print("1. Log into your domain registrar (GoDaddy, Namecheap, etc.)")
            print("2. Go to DNS Management / DNS Settings")
            print("3. Add the records above")
            print("4. Wait 5-15 minutes for DNS propagation")
            print("5. Run this script again to verify")
            
            return True
        else:
            print(f"❌ Cannot get DNS records: {response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ Error getting DNS records: {e}")
        return False

def verify_dns_records(domain_name):
    """Verify DNS records are properly set up"""
    
    print(f"\n🔍 Verifying DNS records for '{domain_name}'...")
    
    try:
        import subprocess
        
        # Check SPF record
        print("📧 Checking SPF record...")
        try:
            spf_result = subprocess.run(
                ['nslookup', '-type=TXT', domain_name], 
                capture_output=True, text=True, timeout=10
            )
            
            if 'mailgun.org' in spf_result.stdout:
                print("✅ SPF record found and contains mailgun.org")
                spf_ok = True
            else:
                print("❌ SPF record not found or incorrect")
                spf_ok = False
        except:
            print("⚠️  Cannot check SPF record")
            spf_ok = False
        
        # Check DKIM record
        print("🔐 Checking DKIM record...")
        try:
            dkim_domain = f"mailo._domainkey.{domain_name}"
            dkim_result = subprocess.run(
                ['nslookup', '-type=TXT', dkim_domain], 
                capture_output=True, text=True, timeout=10
            )
            
            if 'v=DKIM1' in dkim_result.stdout:
                print("✅ DKIM record found")
                dkim_ok = True
            else:
                print("❌ DKIM record not found")
                dkim_ok = False
        except:
            print("⚠️  Cannot check DKIM record")
            dkim_ok = False
        
        if spf_ok and dkim_ok:
            print("\n🎉 DNS records look good!")
            return True
        else:
            print("\n⚠️  Some DNS records are missing or incorrect")
            print("Wait a few more minutes and try again.")
            return False
            
    except Exception as e:
        print(f"❌ Error verifying DNS: {e}")
        return False

def check_domain_status(domain_name):
    """Check if domain is verified and active"""
    
    api_key = os.getenv('MAILGUN_API_KEY')
    base_url = os.getenv('MAILGUN_BASE_URL', 'https://api.mailgun.net/v3')
    
    print(f"📊 Checking domain status for '{domain_name}'...")
    
    try:
        url = f"{base_url}/domains/{domain_name}"
        
        response = requests.get(
            url,
            auth=('api', api_key),
            timeout=10
        )
        
        if response.status_code == 200:
            domain_info = response.json()['domain']
            
            state = domain_info.get('state', 'unknown')
            domain_type = domain_info.get('type', 'unknown')
            
            print(f"📍 Domain: {domain_name}")
            print(f"🔐 Type: {domain_type}")
            print(f"📊 State: {state}")
            
            if state == 'active':
                print("✅ Domain is verified and active!")
                return True
            elif state == 'unverified':
                print("⏳ Domain is not yet verified")
                print("Make sure DNS records are set up correctly")
                return False
            else:
                print(f"⚠️  Domain state: {state}")
                return False
        else:
            print(f"❌ Cannot check domain status: {response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ Error checking domain status: {e}")
        return False

def update_env_file(domain_name):
    """Update .env file with new domain"""
    
    print(f"📝 Updating .env file with domain '{domain_name}'...")
    
    try:
        # Read current .env file
        with open('.env', 'r') as f:
            lines = f.readlines()
        
        # Update relevant lines
        updated_lines = []
        for line in lines:
            if line.startswith('MAILGUN_DOMAIN='):
                updated_lines.append(f'MAILGUN_DOMAIN={domain_name}\n')
            elif line.startswith('MAIL_FROM_ADDRESS='):
                updated_lines.append(f'MAIL_FROM_ADDRESS=noreply@{domain_name}\n')
            else:
                updated_lines.append(line)
        
        # Write back to .env file
        with open('.env', 'w') as f:
            f.writelines(updated_lines)
        
        print("✅ .env file updated successfully!")
        print(f"📧 New from address: noreply@{domain_name}")
        return True
        
    except Exception as e:
        print(f"❌ Error updating .env file: {e}")
        return False

def main():
    """Main setup function"""
    
    print("🚀 Mailgun Custom Domain Setup")
    print("=" * 40)
    
    # Get domain name from user
    domain_name = input("\n📝 Enter your domain name (e.g., yourdomain.com): ").strip()
    
    if not domain_name:
        print("❌ Domain name is required!")
        return
    
    # Remove protocol if provided
    domain_name = domain_name.replace('https://', '').replace('http://', '')
    domain_name = domain_name.replace('www.', '')
    
    print(f"\n🎯 Setting up domain: {domain_name}")
    
    # Step 1: Add domain to Mailgun
    print("\n" + "="*50)
    print("STEP 1: Adding domain to Mailgun")
    print("="*50)
    
    domain_info = add_domain_to_mailgun(domain_name)
    if not domain_info:
        print("❌ Failed to add domain. Please check your Mailgun API key.")
        return
    
    # Step 2: Show DNS records
    print("\n" + "="*50)
    print("STEP 2: DNS Configuration")
    print("="*50)
    
    get_dns_records(domain_name)
    
    # Wait for user to set up DNS
    input("\n⏸️  Press Enter after you've added the DNS records...")
    
    # Step 3: Verify DNS
    print("\n" + "="*50)
    print("STEP 3: Verifying DNS Records")
    print("="*50)
    
    dns_ok = verify_dns_records(domain_name)
    
    if not dns_ok:
        print("\n⚠️  DNS verification failed. Wait a few minutes and try again.")
        retry = input("🔄 Try verification again? (y/n): ").lower()
        if retry == 'y':
            dns_ok = verify_dns_records(domain_name)
    
    # Step 4: Check domain status
    print("\n" + "="*50)
    print("STEP 4: Checking Domain Status")
    print("="*50)
    
    status_ok = check_domain_status(domain_name)
    
    # Step 5: Update .env file
    if status_ok:
        print("\n" + "="*50)
        print("STEP 5: Updating Configuration")
        print("="*50)
        
        update_env_file(domain_name)
        
        print("\n🎉 SETUP COMPLETE!")
        print("=" * 30)
        print("✅ Domain added to Mailgun")
        print("✅ DNS records verified")
        print("✅ Domain is active")
        print("✅ .env file updated")
        print("\n📧 Your emails will now have much better deliverability!")
        print("🧪 Test your contact form to see the improvement.")
    else:
        print("\n⚠️  Setup incomplete. Please:")
        print("1. Double-check your DNS records")
        print("2. Wait 15-30 minutes for DNS propagation")
        print("3. Run this script again")

if __name__ == "__main__":
    main() 