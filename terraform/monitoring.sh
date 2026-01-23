#!/bin/bash

# Script de monitoring pour vérifier la santé de l'infrastructure AWS

# Couleurs
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}=== Weather App - Infrastructure Health Check ===${NC}\n"

# Récupérer les infos depuis Terraform
echo -e "${YELLOW}Fetching infrastructure info...${NC}"
EC2_ID=$(terraform output -raw ec2_instance_id 2>/dev/null)
EC2_IP=$(terraform output -raw ec2_public_ip 2>/dev/null)
RDS_ID="weather-app-db"

if [ -z "$EC2_ID" ]; then
    echo -e "${RED}Error: Terraform outputs not found. Run 'terraform apply' first.${NC}"
    exit 1
fi

# 1. EC2 Status
echo -e "\n${BLUE}1. EC2 Instance Status${NC}"
EC2_STATE=$(aws ec2 describe-instances \
    --instance-ids "$EC2_ID" \
    --query 'Reservations[0].Instances[0].State.Name' \
    --output text)

if [ "$EC2_STATE" = "running" ]; then
    echo -e "   Status: ${GREEN}✓ Running${NC}"
    echo -e "   IP: $EC2_IP"
else
    echo -e "   Status: ${RED}✗ $EC2_STATE${NC}"
fi

# CPU Usage
CPU=$(aws cloudwatch get-metric-statistics \
    --namespace AWS/EC2 \
    --metric-name CPUUtilization \
    --dimensions Name=InstanceId,Value="$EC2_ID" \
    --start-time $(date -u -d '5 minutes ago' +%Y-%m-%dT%H:%M:%S) \
    --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
    --period 300 \
    --statistics Average \
    --query 'Datapoints[0].Average' \
    --output text 2>/dev/null)

if [ "$CPU" != "None" ] && [ -n "$CPU" ]; then
    echo -e "   CPU: ${GREEN}${CPU}%${NC}"
else
    echo -e "   CPU: ${YELLOW}No data${NC}"
fi

# 2. RDS Status
echo -e "\n${BLUE}2. RDS PostgreSQL Status${NC}"
RDS_STATE=$(aws rds describe-db-instances \
    --db-instance-identifier "$RDS_ID" \
    --query 'DBInstances[0].DBInstanceStatus' \
    --output text 2>/dev/null)

if [ "$RDS_STATE" = "available" ]; then
    echo -e "   Status: ${GREEN}✓ Available${NC}"

    # Storage
    STORAGE_USED=$(aws rds describe-db-instances \
        --db-instance-identifier "$RDS_ID" \
        --query 'DBInstances[0].AllocatedStorage' \
        --output text)
    echo -e "   Storage: ${GREEN}${STORAGE_USED}GB allocated${NC}"

    # Connections
    CONNECTIONS=$(aws cloudwatch get-metric-statistics \
        --namespace AWS/RDS \
        --metric-name DatabaseConnections \
        --dimensions Name=DBInstanceIdentifier,Value="$RDS_ID" \
        --start-time $(date -u -d '5 minutes ago' +%Y-%m-%dT%H:%M:%S) \
        --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
        --period 300 \
        --statistics Average \
        --query 'Datapoints[0].Average' \
        --output text 2>/dev/null)

    if [ "$CONNECTIONS" != "None" ] && [ -n "$CONNECTIONS" ]; then
        echo -e "   Connections: ${GREEN}${CONNECTIONS}${NC}"
    fi
else
    echo -e "   Status: ${RED}✗ $RDS_STATE${NC}"
fi

# 3. Application Health
echo -e "\n${BLUE}3. Application Health${NC}"

# Test HTTP
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://$EC2_IP --connect-timeout 5 2>/dev/null)

if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "304" ]; then
    echo -e "   HTTP: ${GREEN}✓ Responding (${HTTP_CODE})${NC}"
else
    echo -e "   HTTP: ${RED}✗ Not responding (${HTTP_CODE})${NC}"
fi

# Test API endpoint
API_RESPONSE=$(curl -s http://$EC2_IP/api/wind-status --connect-timeout 5 2>/dev/null)
if [ -n "$API_RESPONSE" ]; then
    echo -e "   API: ${GREEN}✓ Available${NC}"
else
    echo -e "   API: ${YELLOW}! No response${NC}"
fi

# 4. Recent Backups
echo -e "\n${BLUE}4. Recent RDS Backups${NC}"
LATEST_BACKUP=$(aws rds describe-db-snapshots \
    --db-instance-identifier "$RDS_ID" \
    --query 'DBSnapshots | sort_by(@, &SnapshotCreateTime)[-1].[DBSnapshotIdentifier,SnapshotCreateTime,Status]' \
    --output text 2>/dev/null)

if [ -n "$LATEST_BACKUP" ]; then
    BACKUP_ID=$(echo "$LATEST_BACKUP" | awk '{print $1}')
    BACKUP_TIME=$(echo "$LATEST_BACKUP" | awk '{print $2}')
    BACKUP_STATUS=$(echo "$LATEST_BACKUP" | awk '{print $3}')

    echo -e "   Latest: ${GREEN}$BACKUP_ID${NC}"
    echo -e "   Time: $BACKUP_TIME"
    echo -e "   Status: $BACKUP_STATUS"
else
    echo -e "   ${YELLOW}No backups found${NC}"
fi

# 5. Costs (current month)
echo -e "\n${BLUE}5. Current Month Costs${NC}"
START_DATE=$(date -u +%Y-%m-01)
END_DATE=$(date -u +%Y-%m-%d)

COST=$(aws ce get-cost-and-usage \
    --time-period Start=$START_DATE,End=$END_DATE \
    --granularity MONTHLY \
    --metrics BlendedCost \
    --query 'ResultsByTime[0].Total.BlendedCost.Amount' \
    --output text 2>/dev/null)

if [ -n "$COST" ] && [ "$COST" != "None" ]; then
    COST_ROUNDED=$(printf "%.2f" "$COST")
    echo -e "   Total: ${YELLOW}${COST_ROUNDED}€${NC} (this month)"
else
    echo -e "   ${YELLOW}Cost data not available${NC}"
fi

# 6. Alerts & Recommendations
echo -e "\n${BLUE}6. Alerts & Recommendations${NC}"

# Check disk usage (via SSH)
if [ "$EC2_STATE" = "running" ]; then
    echo -e "   ${YELLOW}! Run on EC2 to check disk: df -h${NC}"
    echo -e "   ${YELLOW}! Run on EC2 to check PM2: pm2 status${NC}"
fi

# Check if RDS storage autoscaling is enabled
MAX_STORAGE=$(aws rds describe-db-instances \
    --db-instance-identifier "$RDS_ID" \
    --query 'DBInstances[0].MaxAllocatedStorage' \
    --output text 2>/dev/null)

if [ "$MAX_STORAGE" = "None" ] || [ -z "$MAX_STORAGE" ]; then
    echo -e "   ${YELLOW}! Consider enabling RDS storage autoscaling${NC}"
fi

# Summary
echo -e "\n${BLUE}=== Summary ===${NC}"
if [ "$EC2_STATE" = "running" ] && [ "$RDS_STATE" = "available" ] && [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}All systems operational ✓${NC}"
else
    echo -e "${YELLOW}Some issues detected - check logs${NC}"
fi

echo -e "\n${BLUE}Quick Actions:${NC}"
echo -e "  SSH to EC2:  ssh -i ~/.ssh/weather-app-key.pem ec2-user@$EC2_IP"
echo -e "  View logs:   pm2 logs"
echo -e "  Backup DB:   ./backup-db.sh"
echo -e "  Cost detail: aws ce get-cost-and-usage --time-period Start=$START_DATE,End=$END_DATE --granularity DAILY --metrics BlendedCost"

echo ""
