#!/bin/bash
# Script pour vérifier que CloudWatch collecte bien les logs

set -e

# Couleurs pour l'output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "========================================="
echo "CloudWatch Configuration Check"
echo "========================================="
echo ""

# Récupérer l'IP de l'instance depuis Terraform
EC2_IP=$(cd .. && terraform output -raw ec2_public_ip 2>/dev/null) || EC2_IP=""
LOG_GROUP=$(cd .. && terraform output -raw cloudwatch_log_group 2>/dev/null) || LOG_GROUP="/aws/ec2/weather-app"

if [ -z "$EC2_IP" ]; then
  echo -e "${RED}❌ Impossible de récupérer l'IP de l'instance${NC}"
  echo "Assurez-vous que Terraform a été appliqué avec succès"
  exit 1
fi

echo -e "${GREEN}✅ Instance EC2:${NC} $EC2_IP"
echo -e "${GREEN}✅ Log Group:${NC} $LOG_GROUP"
echo ""

# Vérifier que CloudWatch Agent est actif sur l'instance
echo "🔍 Vérification de CloudWatch Agent sur l'instance..."
echo ""

read -p "Voulez-vous SSH dans l'instance pour vérifier CloudWatch Agent? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
  echo ""
  echo "Connexion à l'instance..."
  ssh -o StrictHostKeyChecking=no ec2-user@$EC2_IP << 'ENDSSH'
    echo "========================================="
    echo "CloudWatch Agent Status"
    echo "========================================="
    sudo systemctl status amazon-cloudwatch-agent --no-pager
    echo ""

    echo "========================================="
    echo "CloudWatch Agent Config"
    echo "========================================="
    if [ -f /opt/aws/amazon-cloudwatch-agent/etc/cloudwatch-config.json ]; then
      echo "✅ Configuration file exists"
      echo ""
      echo "Log files being monitored:"
      cat /opt/aws/amazon-cloudwatch-agent/etc/cloudwatch-config.json | grep -A 1 "file_path" | grep -v "^\-\-$"
    else
      echo "❌ Configuration file not found"
    fi
    echo ""

    echo "========================================="
    echo "CloudWatch Agent Logs (last 20 lines)"
    echo "========================================="
    if [ -f /opt/aws/amazon-cloudwatch-agent/logs/amazon-cloudwatch-agent.log ]; then
      sudo tail -20 /opt/aws/amazon-cloudwatch-agent/logs/amazon-cloudwatch-agent.log
    else
      echo "❌ Agent log file not found"
    fi
ENDSSH
fi

echo ""
echo "========================================="
echo "CloudWatch Logs via AWS CLI"
echo "========================================="
echo ""

# Vérifier que le log group existe
if aws logs describe-log-groups --log-group-name-prefix "$LOG_GROUP" --query 'logGroups[0].logGroupName' --output text 2>/dev/null | grep -q "$LOG_GROUP"; then
  echo -e "${GREEN}✅ Log group exists:${NC} $LOG_GROUP"

  echo ""
  echo "Log streams available:"
  aws logs describe-log-streams --log-group-name "$LOG_GROUP" --order-by LastEventTime --descending --max-items 10 --query 'logStreams[*].[logStreamName, lastIngestionTime]' --output table

  echo ""
  echo "Recent log entries (last 5 minutes):"
  echo ""
  aws logs tail "$LOG_GROUP" --since 5m --format short || echo -e "${YELLOW}⚠️  No recent logs found${NC}"
else
  echo -e "${RED}❌ Log group not found:${NC} $LOG_GROUP"
  echo "CloudWatch agent may not have started sending logs yet."
  echo "Wait a few minutes and try again."
fi

echo ""
echo "========================================="
echo "Quick Links"
echo "========================================="
echo ""
echo "CloudWatch Dashboard:"
cd .. && terraform output -raw cloudwatch_dashboard_url
echo ""
echo ""
echo "CloudWatch Logs:"
cd .. && terraform output -raw cloudwatch_logs_url
echo ""
echo ""
echo "========================================="
echo "Useful Commands"
echo "========================================="
echo ""
echo "# Tail all logs in real-time:"
echo "aws logs tail $LOG_GROUP --follow"
echo ""
echo "# Tail specific stream:"
echo "aws logs tail $LOG_GROUP --follow --log-stream-names application"
echo ""
echo "# Filter for errors:"
echo "aws logs filter-log-events --log-group-name $LOG_GROUP --filter-pattern ERROR"
echo ""
echo "# Query with CloudWatch Insights:"
echo "aws logs start-query \\"
echo "  --log-group-name $LOG_GROUP \\"
echo "  --start-time \$(date -u -d '1 hour ago' +%s) \\"
echo "  --end-time \$(date -u +%s) \\"
echo "  --query-string 'fields @timestamp, @message | filter @message like /ERROR/ | sort @timestamp desc'"
echo ""
